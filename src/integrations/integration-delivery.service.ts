import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Interval } from '@nestjs/schedule';
import axios from 'axios';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Agent as HttpsAgent } from 'https';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import {
  AuditAction,
  AuditActorType,
  AuditOutcome,
  AuditSource,
  AuditSubjectType,
} from 'src/audit/audit-contract';
import { AuditPayloadSanitizer } from 'src/audit/audit-payload-sanitizer';
import { AuditWriterService } from 'src/audit/audit-writer.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { IntegrationDelivery } from 'src/typeorm/entities/IntegrationDelivery';
import { IntegrationDeliveryAttempt } from 'src/typeorm/entities/IntegrationDeliveryAttempt';
import { IntegrationEndpoint } from 'src/typeorm/entities/IntegrationEndpoint';
import { IntegrationPublisherCheckpoint } from 'src/typeorm/entities/IntegrationPublisherCheckpoint';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { OrganizationRole } from 'src/utils/constants/org_roles';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import {
  CreateIntegrationEndpointDto,
  ListIntegrationDeliveriesDto,
  ReplayIntegrationDeliveryDto,
  RotateIntegrationSecretDto,
  UpdateIntegrationEndpointDto,
} from './dto/integration-delivery.dto';

const PUBLISHER = 'audit-v2';
const MAX_ATTEMPTS = 8;
const CONTROL_ACTIONS = new Set(
  Object.values(AuditAction).filter(
    (a) => a.startsWith('integration_') || a.startsWith('audit_'),
  ),
);

@Injectable()
export class IntegrationDeliveryService {
  private publishing = false;
  private delivering = false;
  constructor(
    @InjectRepository(IntegrationEndpoint)
    private readonly endpoints: Repository<IntegrationEndpoint>,
    @InjectRepository(IntegrationDelivery)
    private readonly deliveries: Repository<IntegrationDelivery>,
    @InjectRepository(IntegrationDeliveryAttempt)
    private readonly attempts: Repository<IntegrationDeliveryAttempt>,
    @InjectRepository(IntegrationPublisherCheckpoint)
    private readonly checkpoints: Repository<IntegrationPublisherCheckpoint>,
    @InjectRepository(AuditLog) private readonly audits: Repository<AuditLog>,
    @InjectRepository(UserOrganization)
    private readonly memberships: Repository<UserOrganization>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectPeer)
    private readonly projectPeers: Repository<ProjectPeer>,
    private readonly entitlements: EntitlementsService,
    private readonly sanitizer: AuditPayloadSanitizer,
    private readonly writer: AuditWriterService,
    private readonly dataSource: DataSource,
  ) {}

  private async admin(user: any, organizationId: string) {
    await this.entitlements.assertCapability(
      user,
      organizationId,
      CapabilityKey.RELIABLE_INTEGRATION_DELIVERY,
    );
    await this.entitlements.assertCapability(
      user,
      organizationId,
      CapabilityKey.ADVANCED_AUDIT_TRAIL,
    );
    const membership = await this.memberships.findOne({
      where: {
        organization_id: organizationId,
        user_id: user.userId,
        is_active: true,
        role: OrganizationRole.ORG_ADMIN,
      },
    });
    if (!membership)
      throw new NotFoundException('Integration endpoint not found');
  }
  private async readScope(
    user: any,
    organizationId: string,
    projectId?: number,
  ) {
    await this.entitlements.assertCapability(
      user,
      organizationId,
      CapabilityKey.RELIABLE_INTEGRATION_DELIVERY,
    );
    await this.entitlements.assertCapability(
      user,
      organizationId,
      CapabilityKey.ADVANCED_AUDIT_TRAIL,
    );
    const membership = await this.memberships.findOne({
      where: {
        organization_id: organizationId,
        user_id: user.userId,
        is_active: true,
      },
    });
    if (!membership)
      throw new NotFoundException('Integration delivery not found');
    if (membership.role === OrganizationRole.ORG_ADMIN)
      return { admin: true, projectId };
    if (!projectId)
      throw new NotFoundException('Integration delivery not found');
    const ownership = await this.projectPeers.findOne({
      where: {
        organization_id: organizationId,
        user: { id: user.userId },
        project: { id: projectId },
        role: ProjectRole.OWNER,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
      relations: ['user', 'project'],
    });
    if (!ownership)
      throw new NotFoundException('Integration delivery not found');
    return { admin: false, projectId };
  }
  private async assertProject(organizationId: string, projectId?: number) {
    if (!projectId) return;
    const project = await this.projects.findOne({
      where: { id: projectId, organization: { id: organizationId } },
      relations: ['organization'],
    });
    if (!project) throw new NotFoundException('Project not found');
  }
  private safe(row: IntegrationEndpoint) {
    const {
      secret_ciphertext: _a,
      previous_secret_ciphertext: _b,
      ...safe
    } = row;
    return safe;
  }
  private key() {
    return createHash('sha256')
      .update(
        process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ||
          process.env.JWT_ACCESS_TOKEN_SECRET ||
          'development-only-webhook-key',
      )
      .digest();
  }
  private encrypt(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const value = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), value]
      .map((v) => v.toString('base64url'))
      .join('.');
  }
  private decrypt(value: string) {
    const [iv, tag, encrypted] = value
      .split('.')
      .map((v) => Buffer.from(v, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
  private newSecret() {
    return `whsec_${randomBytes(32).toString('base64url')}`;
  }

  private privateAddress(address: string) {
    if (!isIP(address)) return true;
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice(7);
      return isIP(mapped) === 4 ? this.privateAddress(mapped) : true;
    }
    if (normalized.includes(':'))
      return (
        normalized === '::' ||
        normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe8') ||
        normalized.startsWith('fe9') ||
        normalized.startsWith('fea') ||
        normalized.startsWith('feb') ||
        normalized.startsWith('ff') ||
        normalized.startsWith('2001:db8')
      );
    const parts = address.split('.').map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      (parts[0] === 192 && parts[1] === 0) ||
      (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) ||
      (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) ||
      (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) ||
      parts[0] >= 224
    );
  }
  private async validateDestination(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Invalid endpoint URL');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443')
    )
      throw new BadRequestException(
        'Endpoint must use standard HTTPS without credentials',
      );
    const addresses = await lookup(url.hostname, {
      all: true,
      verbatim: true,
    }).catch(() => []);
    if (
      !addresses.length ||
      addresses.some((item) => this.privateAddress(item.address))
    )
      throw new BadRequestException('Endpoint destination is not allowed');
    return {
      url: url.toString(),
      address: addresses[0].address,
      family: addresses[0].family,
    };
  }
  private validateActions(actions: string[]) {
    const allowed = new Set(
      Object.values(AuditAction).filter((a) => !CONTROL_ACTIONS.has(a)),
    );
    const unique = [...new Set(actions)];
    if (!unique.length || unique.some((a) => !allowed.has(a as AuditAction)))
      throw new BadRequestException('Unsupported integration action');
    return unique;
  }
  private pinnedAgent(destination: { address: string; family: number }) {
    return new HttpsAgent({
      lookup: ((_hostname: string, _options: any, callback: any) =>
        callback(null, destination.address, destination.family)) as any,
    });
  }
  private retryDelay(attempt: number, retryAfter?: unknown) {
    const value = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
    if (typeof value === 'string' || typeof value === 'number') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0)
        return Math.min(3_600_000, seconds * 1000);
      const date = new Date(String(value));
      if (!Number.isNaN(date.getTime()))
        return Math.max(0, Math.min(3_600_000, date.getTime() - Date.now()));
    }
    const base = Math.min(3_600_000, 5000 * 2 ** (attempt - 1));
    return Math.round(base * (0.9 + Math.random() * 0.2));
  }
  private signatures(
    endpoint: IntegrationEndpoint,
    timestamp: string,
    body: string,
  ) {
    const encrypted = [endpoint.secret_ciphertext];
    if (
      endpoint.previous_secret_ciphertext &&
      endpoint.previous_secret_expires_at &&
      endpoint.previous_secret_expires_at > new Date()
    )
      encrypted.push(endpoint.previous_secret_ciphertext);
    return encrypted
      .map((value) =>
        createHmac('sha256', this.decrypt(value))
          .update(timestamp)
          .update('.')
          .update(body)
          .digest('hex'),
      )
      .map((digest) => `sha256=${digest}`)
      .join(',');
  }
  private async capabilitiesEnabled(organizationId: string) {
    return this.entitlements
      .resolveOrganization(organizationId)
      .then((items) => {
        const enabled = new Set(
          items.filter((item) => item.enabled).map((item) => item.key),
        );
        return (
          enabled.has(CapabilityKey.RELIABLE_INTEGRATION_DELIVERY) &&
          enabled.has(CapabilityKey.ADVANCED_AUDIT_TRAIL)
        );
      })
      .catch(() => false);
  }

  async listEndpoints(user: any, organizationId: string) {
    await this.admin(user, organizationId);
    return (
      await this.endpoints.find({
        where: { organization_id: organizationId },
        order: { created_at: 'DESC' },
      })
    ).map((r) => this.safe(r));
  }
  async createEndpoint(
    user: any,
    organizationId: string,
    dto: CreateIntegrationEndpointDto,
  ) {
    await this.admin(user, organizationId);
    await this.assertProject(organizationId, dto.projectId);
    const destination = await this.validateDestination(dto.url);
    const secret = this.newSecret();
    const row = await this.dataSource.transaction(async (manager) => {
      const endpoint = manager.getRepository(IntegrationEndpoint).create({
        organization_id: organizationId,
        project_id: dto.projectId ?? null,
        name: dto.name.trim(),
        url: destination.url,
        actions: this.validateActions(dto.actions),
        secret_ciphertext: this.encrypt(secret),
        previous_secret_ciphertext: null,
        previous_secret_expires_at: null,
        active: true,
        created_by_user_id: user.userId,
      });
      await manager.getRepository(IntegrationEndpoint).save(endpoint);
      await this.writer.append(manager, {
        organizationId,
        projectId: endpoint.project_id,
        action: AuditAction.INTEGRATION_ENDPOINT_CREATED,
        actor: {
          type: AuditActorType.HUMAN,
          id: user.userId,
          label: 'Organization administrator',
        },
        subject: {
          type: AuditSubjectType.INTEGRATION_ENDPOINT,
          id: endpoint.id,
        },
        source: AuditSource.API,
        outcome: AuditOutcome.SUCCEEDED,
        after: {
          name: endpoint.name,
          active: true,
          project_id: endpoint.project_id,
          action_count: endpoint.actions.length,
        },
        correlationId: this.writer.correlationId(),
      });
      return endpoint;
    });
    return { ...this.safe(row), secret };
  }
  async updateEndpoint(
    user: any,
    organizationId: string,
    id: string,
    dto: UpdateIntegrationEndpointDto,
  ) {
    await this.admin(user, organizationId);
    const row = await this.endpoints.findOne({
      where: { id, organization_id: organizationId },
    });
    if (!row) throw new NotFoundException('Integration endpoint not found');
    const before = {
      name: row.name,
      active: row.active,
      project_id: row.project_id,
      action_count: row.actions.length,
    };
    if (dto.url) row.url = (await this.validateDestination(dto.url)).url;
    if (dto.name) row.name = dto.name.trim();
    if (dto.actions) row.actions = this.validateActions(dto.actions);
    if (dto.active !== undefined) row.active = dto.active;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(IntegrationEndpoint).save(row);
      await this.writer.append(manager, {
        organizationId,
        projectId: row.project_id,
        action: AuditAction.INTEGRATION_ENDPOINT_UPDATED,
        actor: {
          type: AuditActorType.HUMAN,
          id: user.userId,
          label: 'Organization administrator',
        },
        subject: { type: AuditSubjectType.INTEGRATION_ENDPOINT, id: row.id },
        source: AuditSource.API,
        before,
        after: {
          name: row.name,
          active: row.active,
          project_id: row.project_id,
          action_count: row.actions.length,
        },
        correlationId: this.writer.correlationId(),
      });
    });
    return this.safe(row);
  }
  async rotate(
    user: any,
    organizationId: string,
    id: string,
    dto: RotateIntegrationSecretDto,
  ) {
    await this.admin(user, organizationId);
    const row = await this.endpoints
      .createQueryBuilder('e')
      .addSelect(['e.secret_ciphertext', 'e.previous_secret_ciphertext'])
      .where('e.id=:id AND e.organization_id=:organizationId', {
        id,
        organizationId,
      })
      .getOne();
    if (!row) throw new NotFoundException('Integration endpoint not found');
    const secret = this.newSecret();
    const overlap = dto.overlapMinutes ?? 60;
    row.previous_secret_ciphertext = overlap ? row.secret_ciphertext : null;
    row.previous_secret_expires_at = overlap
      ? new Date(Date.now() + overlap * 60_000)
      : null;
    row.secret_ciphertext = this.encrypt(secret);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(IntegrationEndpoint).save(row);
      await this.writer.append(manager, {
        organizationId,
        projectId: row.project_id,
        action: AuditAction.INTEGRATION_SECRET_ROTATED,
        actor: {
          type: AuditActorType.HUMAN,
          id: user.userId,
          label: 'Organization administrator',
        },
        subject: { type: AuditSubjectType.INTEGRATION_ENDPOINT, id: row.id },
        source: AuditSource.API,
        after: {
          name: row.name,
          active: row.active,
          project_id: row.project_id,
          action_count: row.actions.length,
        },
        metadata: { overlap_minutes: overlap },
        correlationId: this.writer.correlationId(),
      });
    });
    return { ...this.safe(row), secret };
  }
  async testEndpoint(user: any, organizationId: string, id: string) {
    await this.admin(user, organizationId);
    const endpoint = await this.endpoints
      .createQueryBuilder('e')
      .addSelect([
        'e.secret_ciphertext',
        'e.previous_secret_ciphertext',
        'e.previous_secret_expires_at',
      ])
      .where('e.id=:id AND e.organization_id=:organizationId', {
        id,
        organizationId,
      })
      .getOne();
    if (!endpoint)
      throw new NotFoundException('Integration endpoint not found');
    const destination = await this.validateDestination(endpoint.url);
    const body = JSON.stringify({
      version: 1,
      test: true,
      deliveryId: null,
      event: {
        id: null,
        action: 'integration.test',
        occurredAt: new Date().toISOString(),
      },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.signatures(endpoint, timestamp, body);
    try {
      const response = await axios.post(destination.url, body, {
        headers: {
          'content-type': 'application/json',
          'x-tailpoint-test': 'true',
          'x-tailpoint-timestamp': timestamp,
          'x-tailpoint-signature': signature,
        },
        httpsAgent: this.pinnedAgent(destination),
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true,
        maxContentLength: 8192,
        maxBodyLength: 262144,
      });
      return {
        ok: response.status >= 200 && response.status < 300,
        statusCode: response.status,
      };
    } catch (e: any) {
      return {
        ok: false,
        errorCode: e?.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR',
      };
    }
  }
  async listDeliveries(
    user: any,
    organizationId: string,
    query: ListIntegrationDeliveriesDto,
  ) {
    const scope = await this.readScope(user, organizationId, query.projectId);
    const qb = this.deliveries
      .createQueryBuilder('d')
      .where('d.organization_id=:organizationId', { organizationId });
    if (!scope.admin)
      qb.andWhere('d.project_id=:ownedProjectId', {
        ownedProjectId: scope.projectId,
      });
    if (query.endpointId)
      qb.andWhere('d.endpoint_id=:endpointId', {
        endpointId: query.endpointId,
      });
    if (query.state) qb.andWhere('d.state=:state', { state: query.state });
    if (query.projectId)
      qb.andWhere('d.project_id=:projectId', { projectId: query.projectId });
    return qb
      .orderBy('d.created_at', 'DESC')
      .take(query.limit ?? 50)
      .getMany();
  }
  async supportHealth(organizationId: string) {
    const endpointCounts = await this.endpoints
      .createQueryBuilder('e')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN e.active = 1 THEN 1 ELSE 0 END)', 'active')
      .where('e.organization_id = :organizationId', { organizationId })
      .getRawOne();
    const states = await this.deliveries
      .createQueryBuilder('d')
      .select('d.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .where('d.organization_id = :organizationId', { organizationId })
      .groupBy('d.state')
      .getRawMany();
    return {
      organizationId,
      endpoints: {
        total: Number(endpointCounts?.total ?? 0),
        active: Number(endpointCounts?.active ?? 0),
      },
      deliveries: Object.fromEntries(
        states.map((row) => [row.state, Number(row.count)]),
      ),
    };
  }
  async delivery(
    user: any,
    organizationId: string,
    id: string,
    projectId?: number,
  ) {
    const scope = await this.readScope(user, organizationId, projectId);
    const where: any = { id, organization_id: organizationId };
    if (!scope.admin) where.project_id = scope.projectId;
    const row = await this.deliveries.findOne({ where });
    if (!row) throw new NotFoundException('Integration delivery not found');
    return {
      ...row,
      attempts: await this.attempts.find({
        where: { delivery_id: id },
        order: { attempt_number: 'ASC' },
      }),
    };
  }
  async replay(
    user: any,
    organizationId: string,
    id: string,
    dto: ReplayIntegrationDeliveryDto,
  ) {
    await this.admin(user, organizationId);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(IntegrationDelivery);
      const source = await repo.findOne({
        where: { id, organization_id: organizationId, state: 'dead_letter' },
      });
      if (!source)
        throw new NotFoundException('Integration delivery not found');
      const latest = await repo
        .createQueryBuilder('d')
        .select('MAX(d.generation)', 'generation')
        .where('d.endpoint_id=:endpointId AND d.audit_event_id=:eventId', {
          endpointId: source.endpoint_id,
          eventId: source.audit_event_id,
        })
        .getRawOne();
      const row = repo.create({
        organization_id: organizationId,
        project_id: source.project_id,
        endpoint_id: source.endpoint_id,
        audit_event_id: source.audit_event_id,
        generation: Number(latest.generation) + 1,
        state: 'queued',
        attempt_count: 0,
        next_attempt_at: new Date(),
        replayed_by_user_id: user.userId,
        replay_reason: dto.reason,
      });
      await repo.save(row);
      await this.writer.append(manager, {
        organizationId,
        projectId: row.project_id,
        action: AuditAction.INTEGRATION_DELIVERY_REPLAYED,
        actor: {
          type: AuditActorType.HUMAN,
          id: user.userId,
          label: 'Organization administrator',
        },
        subject: { type: AuditSubjectType.INTEGRATION_DELIVERY, id: row.id },
        source: AuditSource.API,
        after: {
          status: 'queued',
          generation: row.generation,
          event_id: row.audit_event_id,
        },
        correlationId: this.writer.correlationId(),
      });
      return row;
    });
  }

  @Interval(3000) async publish() {
    if (this.publishing) return;
    this.publishing = true;
    try {
      await this.dataSource.transaction(async (manager) => {
        const checkpoints = manager.getRepository(
          IntegrationPublisherCheckpoint,
        );
        let checkpoint = await checkpoints.findOne({
          where: { publisher: PUBLISHER },
          lock: { mode: 'pessimistic_write' },
        });
        if (!checkpoint) {
          checkpoint = checkpoints.create({
            publisher: PUBLISHER,
            occurred_at: new Date(),
            event_id: null,
          });
          await checkpoints.save(checkpoint);
          return;
        }
        const qb = manager
          .getRepository(AuditLog)
          .createQueryBuilder('a')
          .where('a.schema_version=2')
          .andWhere('a.organization_id IS NOT NULL')
          .andWhere(
            '(a.occurred_at > :at OR (a.occurred_at = :at AND a.id > :id))',
            { at: checkpoint.occurred_at, id: checkpoint.event_id ?? '' },
          )
          .orderBy('a.occurred_at', 'ASC')
          .addOrderBy('a.id', 'ASC')
          .take(100);
        const events = await qb.getMany();
        for (const event of events) {
          const enabled = await this.capabilitiesEnabled(event.organization_id);
          if (enabled && !CONTROL_ACTIONS.has(event.action as AuditAction)) {
            const endpoints = await manager
              .getRepository(IntegrationEndpoint)
              .find({
                where: { organization_id: event.organization_id, active: true },
              });
            for (const endpoint of endpoints) {
              if (
                endpoint.actions.includes(event.action) &&
                (!endpoint.project_id ||
                  endpoint.project_id === event.project_id)
              )
                await manager.getRepository(IntegrationDelivery).upsert(
                  {
                    organization_id: event.organization_id,
                    project_id: event.project_id,
                    endpoint_id: endpoint.id,
                    audit_event_id: event.id,
                    generation: 1,
                    state: 'queued',
                    attempt_count: 0,
                    next_attempt_at: new Date(),
                  },
                  ['endpoint_id', 'audit_event_id', 'generation'],
                );
            }
          }
          checkpoint.occurred_at = event.occurred_at ?? event.created_at;
          checkpoint.event_id = event.id;
        }
        if (events.length) await checkpoints.save(checkpoint);
      });
    } finally {
      this.publishing = false;
    }
  }

  private envelope(event: AuditLog, delivery: IntegrationDelivery) {
    return {
      version: 1,
      deliveryId: delivery.id,
      event: {
        id: event.id,
        occurredAt: (event.occurred_at ?? event.created_at).toISOString(),
        organizationId: event.organization_id,
        projectId: event.project_id,
        action: event.action,
        outcome: event.outcome,
        actor: {
          type: event.actor_type,
          id: event.actor_id,
          label: event.actor_label,
        },
        subject: {
          type: event.subject_type,
          id: event.subject_id,
          label: event.subject_label,
        },
        correlationId: event.correlation_id,
        causationId: event.causation_id,
        before: this.sanitizer.sanitizeChanges(
          event.subject_type,
          event.before_changes,
        ),
        after: this.sanitizer.sanitizeChanges(
          event.subject_type,
          event.after_changes,
        ),
        metadata: this.sanitizer.sanitizeMetadata(event.metadata),
      },
    };
  }
  @Interval(3000) async deliver() {
    if (this.delivering) return;
    this.delivering = true;
    try {
      const now = new Date();
      await this.deliveries
        .createQueryBuilder()
        .update()
        .set({
          state: 'queued',
          lease_expires_at: null,
          failure_code: 'LEASE_RECOVERED',
          next_attempt_at: now,
        })
        .where("state = 'sending' AND lease_expires_at <= :now", { now })
        .execute();
      const row = await this.deliveries.findOne({
        where: { state: 'queued', next_attempt_at: LessThanOrEqual(now) },
        order: { next_attempt_at: 'ASC' },
      });
      if (!row) return;
      const lease = new Date(Date.now() + 30000);
      const claim = await this.deliveries.update(
        { id: row.id, state: 'queued' },
        { state: 'sending', lease_expires_at: lease },
      );
      if (!claim.affected) return;
      await this.send(row);
    } finally {
      this.delivering = false;
    }
  }
  private async send(row: IntegrationDelivery) {
    const endpoint = await this.endpoints
      .createQueryBuilder('e')
      .addSelect([
        'e.secret_ciphertext',
        'e.previous_secret_ciphertext',
        'e.previous_secret_expires_at',
      ])
      .where('e.id=:id', { id: row.endpoint_id })
      .getOne();
    const event = await this.audits.findOne({
      where: { id: row.audit_event_id },
    });
    const enabled = endpoint
      ? await this.capabilitiesEnabled(endpoint.organization_id)
      : false;
    if (!endpoint?.active || !event || !enabled) {
      await this.deliveries.update(row.id, {
        state: 'cancelled',
        failure_code: 'ENDPOINT_UNAVAILABLE',
        completed_at: new Date(),
      });
      return;
    }
    const attempt = row.attempt_count + 1;
    const started = Date.now();
    let status: number | null = null;
    let error = 'DELIVERY_FAILED';
    let retry = true;
    let retryAfter: unknown;
    try {
      const destination = await this.validateDestination(endpoint.url);
      const body = JSON.stringify(this.envelope(event, row));
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = this.signatures(endpoint, timestamp, body);
      const response = await axios.post(destination.url, body, {
        headers: {
          'content-type': 'application/json',
          'x-tailpoint-delivery': row.id,
          'x-tailpoint-event': event.id,
          'x-tailpoint-timestamp': timestamp,
          'x-tailpoint-signature': signature,
        },
        httpsAgent: this.pinnedAgent(destination),
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true,
        maxContentLength: 8192,
        maxBodyLength: 262144,
      });
      status = response.status;
      retryAfter = response.headers?.['retry-after'];
      if (status >= 200 && status < 300) {
        await this.finish(
          row,
          attempt,
          'succeeded',
          status,
          null,
          Date.now() - started,
          null,
        );
        return;
      }
      retry = [408, 425, 429].includes(status) || status >= 500;
      error = retry ? 'HTTP_RETRYABLE' : 'HTTP_PERMANENT';
    } catch (e: any) {
      error =
        e instanceof BadRequestException
          ? 'DESTINATION_BLOCKED'
          : e?.code === 'ECONNABORTED'
            ? 'TIMEOUT'
            : 'NETWORK_ERROR';
      retry = error !== 'DESTINATION_BLOCKED';
    }
    const dead = !retry || attempt >= MAX_ATTEMPTS;
    const next = dead
      ? null
      : new Date(Date.now() + this.retryDelay(attempt, retryAfter));
    await this.finish(
      row,
      attempt,
      dead ? 'dead_letter' : 'retrying',
      status,
      error,
      Date.now() - started,
      next,
    );
  }
  private async finish(
    row: IntegrationDelivery,
    attempt: number,
    outcome: string,
    status: number | null,
    error: string | null,
    duration: number,
    next: Date | null,
  ) {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(IntegrationDeliveryAttempt).insert({
        delivery_id: row.id,
        attempt_number: attempt,
        outcome,
        status_code: status,
        error_code: error,
        duration_ms: duration,
        next_attempt_at: next,
      });
      await manager.getRepository(IntegrationDelivery).update(
        { id: row.id, state: 'sending' },
        {
          state:
            outcome === 'succeeded'
              ? 'succeeded'
              : outcome === 'dead_letter'
                ? 'dead_letter'
                : 'queued',
          attempt_count: attempt,
          next_attempt_at: next,
          lease_expires_at: null,
          failure_code: error,
          completed_at:
            outcome === 'succeeded' || outcome === 'dead_letter'
              ? new Date()
              : null,
        },
      );
    });
  }
}
