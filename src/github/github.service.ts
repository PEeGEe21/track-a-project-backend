import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { BlockList, isIP } from 'net';
import { Queue, Worker } from 'bullmq';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditWriterService } from 'src/audit/audit-writer.service';
import {
  AuditAction,
  AuditActorType,
  AuditSource,
  AuditSubjectType,
} from 'src/audit/audit-contract';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { GithubConnection } from 'src/typeorm/entities/GithubConnection';
import { GithubDelivery } from 'src/typeorm/entities/GithubDelivery';
import { GithubArtifact } from 'src/typeorm/entities/GithubArtifact';
import { GithubTaskLink } from 'src/typeorm/entities/GithubTaskLink';
import { GithubLinkDiagnostic } from 'src/typeorm/entities/GithubLinkDiagnostic';
import { Task } from 'src/typeorm/entities/Task';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { ActivityType } from 'src/utils/constants/activity';
import { RedisService } from 'src/redis/redis.service';
import { RedisThrottlerStorage } from 'src/common/rate-limit/redis-throttler.storage';
import { config } from 'src/config';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { NOTIFICATION_TYPES } from 'src/utils/constants/notifications';
import {
  CreateGithubConnectionDto,
  RotateGithubSecretDto,
  UpdateGithubConnectionDto,
} from './dto/github-integration.dto';

type ArtifactInput = {
  type: string;
  providerId: string;
  reference?: string;
  title?: string;
  state?: string;
  url: string;
  actor?: string;
  metadata?: Record<string, unknown>;
  updatedAt?: string;
  taskIds: number[];
  taskReferences?: Array<{ taskId: number; source: string; value: string }>;
};

type GithubDeliveryJob = {
  connectionId: string;
  deliveryId: string;
  artifacts: ArtifactInput[];
};
@Injectable()
export class GithubService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<GithubDeliveryJob> | null = null;
  private worker: Worker<GithubDeliveryJob> | null = null;

  constructor(
    @InjectRepository(GithubConnection)
    private connections: Repository<GithubConnection>,
    @InjectRepository(GithubDelivery)
    private deliveries: Repository<GithubDelivery>,
    @InjectRepository(GithubArtifact)
    private artifacts: Repository<GithubArtifact>,
    @InjectRepository(GithubTaskLink) private links: Repository<GithubTaskLink>,
    @InjectRepository(Task) private tasks: Repository<Task>,
    private authorization: AuthorizationService,
    private entitlements: EntitlementsService,
    private dataSource: DataSource,
    private auditWriter: AuditWriterService,
    private redis: RedisService,
    private throttler: RedisThrottlerStorage,
    private notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    if (config.queue.driver !== 'redis') return;
    const connection = this.redis.getBullConnection();
    if (!connection) return;
    this.queue = new Queue<GithubDeliveryJob>('github-deliveries', {
      connection,
      prefix: config.redis.prefix,
    });
    this.worker = new Worker<GithubDeliveryJob>(
      'github-deliveries',
      async (job) => this.processDelivery(job.data),
      { connection, prefix: config.redis.prefix, concurrency: 5 },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
  private async auditEnabled(org: string) {
    return Boolean(
      (await this.entitlements.resolveOrganization(org)).find(
        (item) => item.key === CapabilityKey.ADVANCED_AUDIT_TRAIL,
      )?.enabled,
    );
  }
  private async recordLifecycle(
    manager: EntityManager,
    user: any,
    org: string,
    row: GithubConnection,
    action: AuditAction,
    description: string,
    auditEnabled: boolean,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ) {
    const activities = manager.getRepository(ProjectActivity);
    await activities.save(
      activities.create({
        organization_id: org,
        projectId: row.project_id,
        userId: user.userId,
        activityType: ActivityType.PROJECT_UPDATED,
        description,
        entityType: 'github_connection',
        metadata: {
          connectionId: row.id,
          repository: row.repository_full_name,
        },
      }),
    );
    if (!auditEnabled) return;
    await this.auditWriter.append(manager, {
      organizationId: org,
      projectId: row.project_id,
      action,
      actor: {
        type: AuditActorType.HUMAN,
        id: user.userId,
        label: `User ${user.userId}`,
      },
      subject: {
        type: AuditSubjectType.GITHUB_CONNECTION,
        id: row.id,
        label: row.repository_full_name,
      },
      source: AuditSource.API,
      correlationId: this.auditWriter.correlationId(),
      before,
      after,
    });
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
    const iv = randomBytes(12),
      c = createCipheriv('aes-256-gcm', this.key(), iv);
    const value = Buffer.concat([c.update(secret, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), value]
      .map((v) => v.toString('base64url'))
      .join('.');
  }
  private decrypt(value: string) {
    const [iv, tag, data] = value
      .split('.')
      .map((v) => Buffer.from(v, 'base64url'));
    const d = createDecipheriv('aes-256-gcm', this.key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  }
  private secret() {
    return randomBytes(32).toString('base64url');
  }
  private safe(row: GithubConnection) {
    const {
      secret_ciphertext: _a,
      previous_secret_ciphertext: _b,
      ...safe
    } = row;
    return safe;
  }
  private async owner(user: any, org: string, projectId: number) {
    await this.entitlements.assertCapability(
      user,
      org,
      CapabilityKey.GITHUB_INTEGRATION,
    );
    const context = await this.authorization.assertProjectPermission(
      user,
      org,
      projectId,
      ProjectPermission.MANAGE_SETTINGS,
    );
    if (context.role !== 'owner')
      throw new NotFoundException('GitHub connection not found');
  }
  async list(user: any, org: string, projectId: number) {
    await this.entitlements.assertCapability(
      user,
      org,
      CapabilityKey.GITHUB_INTEGRATION,
    );
    await this.authorization.assertProjectPermission(
      user,
      org,
      projectId,
      ProjectPermission.VIEW,
    );
    return {
      success: true,
      data: (
        await this.connections.find({
          where: {
            organization_id: org,
            project_id: projectId,
            archived_at: IsNull(),
          },
          order: { created_at: 'DESC' },
        })
      ).map((v) => this.safe(v)),
    };
  }
  async create(user: any, org: string, dto: CreateGithubConnectionDto) {
    await this.owner(user, org, dto.projectId);
    const repository = dto.repository.trim().toLowerCase();
    const existing = await this.connections.findOne({
      where: { project_id: dto.projectId, repository_full_name: repository },
    });
    if (existing && !existing.archived_at)
      throw new ConflictException('Repository is already connected');
    const secret = this.secret();
    const auditEnabled = await this.auditEnabled(org);
    const row = await this.dataSource.transaction(async (manager) => {
      const connections = manager.getRepository(GithubConnection);
      const saved = await connections.save(
        connections.create({
          ...(existing ?? {}),
          organization_id: org,
          project_id: dto.projectId,
          repository_full_name: repository,
          provider_repository_id: null,
          webhook_key: randomBytes(24).toString('hex'),
          secret_ciphertext: this.encrypt(secret),
          previous_secret_ciphertext: null,
          previous_secret_expires_at: null,
          active: true,
          created_by_user_id: user.userId,
          last_delivery_at: null,
          last_delivery_state: null,
          health_state: 'pending',
          consecutive_failures: 0,
          health_alerted_at: null,
          rotation_alerted_at: null,
          rotation_confirmed_at: null,
          repository_renamed_at: null,
          archived_at: null,
        }),
      );
      await this.recordLifecycle(
        manager,
        user,
        org,
        saved,
        AuditAction.GITHUB_CONNECTION_CREATED,
        `Connected GitHub repository ${repository}`,
        auditEnabled,
        undefined,
        { repository, active: true },
      );
      return saved;
    });
    return {
      success: true,
      data: {
        ...this.safe(row),
        secret,
        webhookPath: `/github/webhooks/${row.webhook_key}`,
      },
    };
  }
  private async managed(user: any, org: string, id: string) {
    const row = await this.connections.findOne({
      where: { id, organization_id: org },
    });
    if (!row) throw new NotFoundException('GitHub connection not found');
    await this.owner(user, org, row.project_id);
    return row;
  }
  async detail(user: any, org: string, id: string) {
    const row = await this.managed(user, org, id);
    return { success: true, data: this.safe(row) };
  }
  async update(
    user: any,
    org: string,
    id: string,
    dto: UpdateGithubConnectionDto,
  ) {
    const row = await this.managed(user, org, id);
    const before = { active: row.active };
    if (dto.active !== undefined) {
      row.active = dto.active;
      row.health_state = dto.active ? 'pending' : 'disabled';
      row.health_alerted_at = null;
    }
    const auditEnabled = await this.auditEnabled(org);
    const saved = await this.dataSource.transaction(async (manager) => {
      const value = await manager.getRepository(GithubConnection).save(row);
      await this.recordLifecycle(
        manager,
        user,
        org,
        value,
        AuditAction.GITHUB_CONNECTION_UPDATED,
        `${value.active ? 'Enabled' : 'Disabled'} GitHub repository ${
          value.repository_full_name
        }`,
        auditEnabled,
        before,
        { active: value.active },
      );
      return value;
    });
    return { success: true, data: this.safe(saved) };
  }
  async rotate(user: any, org: string, id: string, dto: RotateGithubSecretDto) {
    const row = await this.managed(user, org, id);
    const secret = this.secret();
    const overlapMinutes = dto.overlapMinutes ?? 60;
    const auditEnabled = await this.auditEnabled(org);
    await this.dataSource.transaction(async (manager) => {
      const connections = manager.getRepository(GithubConnection);
      const current = await connections
        .createQueryBuilder('c')
        .addSelect(['c.secret_ciphertext'])
        .where('c.id=:id', { id })
        .getOneOrFail();
      row.previous_secret_ciphertext = current.secret_ciphertext;
      row.previous_secret_expires_at = new Date(
        Date.now() + overlapMinutes * 60000,
      );
      row.secret_ciphertext = this.encrypt(secret);
      row.rotation_alerted_at = null;
      row.rotation_confirmed_at = null;
      await connections.save(row);
      await this.recordLifecycle(
        manager,
        user,
        org,
        row,
        AuditAction.GITHUB_CONNECTION_SECRET_ROTATED,
        `Rotated the GitHub webhook secret for ${row.repository_full_name}`,
        auditEnabled,
        undefined,
        { rotation_overlap_minutes: overlapMinutes },
      );
    });
    return { success: true, data: { ...this.safe(row), secret } };
  }
  async connectionDeliveries(user: any, org: string, id: string) {
    const row = await this.managed(user, org, id);
    return {
      success: true,
      data: await this.deliveries.find({
        where: { connection_id: row.id, organization_id: org },
        order: { received_at: 'DESC' },
        take: 100,
      }),
    };
  }
  async archive(user: any, org: string, id: string) {
    const row = await this.managed(user, org, id);
    row.active = false;
    row.archived_at = new Date();
    row.health_state = 'archived';
    const auditEnabled = await this.auditEnabled(org);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(GithubConnection).save(row);
      await this.recordLifecycle(
        manager,
        user,
        org,
        row,
        AuditAction.GITHUB_CONNECTION_ARCHIVED,
        `Archived GitHub repository connection ${row.repository_full_name}`,
        auditEnabled,
        { active: true },
        { active: false, archived_at: row.archived_at },
      );
    });
    return { success: true };
  }
  async taskLinks(user: any, org: string, taskId: number) {
    await this.entitlements.assertCapability(
      user,
      org,
      CapabilityKey.GITHUB_INTEGRATION,
    );
    const task = await this.tasks.findOne({
      where: { id: taskId, organization_id: org },
      relations: ['project'],
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.authorization.assertProjectPermission(
      user,
      org,
      task.project.id,
      ProjectPermission.VIEW,
    );
    const rows = await this.links
      .createQueryBuilder('l')
      .innerJoinAndSelect(GithubArtifact, 'a', 'a.id=l.artifact_id')
      .innerJoinAndSelect(GithubConnection, 'c', 'c.id=a.connection_id')
      .where(
        "l.task_id=:taskId AND l.organization_id=:org AND l.project_id=:projectId AND l.state='active'",
        { taskId, org, projectId: task.project.id },
      )
      .orderBy('l.updated_at', 'DESC')
      .getRawMany();
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.a_id,
        type: r.a_artifact_type,
        reference: r.a_reference,
        title: r.a_title,
        state: r.a_state,
        url: r.a_url,
        actor: r.a_actor_label,
        metadata: r.a_metadata,
        updatedAt: r.a_provider_updated_at ?? r.a_updated_at,
        repository: r.c_repository_full_name,
        connectionArchived: Boolean(r.c_archived_at),
        linkSource: r.l_source,
        sourceValue: r.l_source_value,
        manuallyOverridden: Boolean(r.l_manually_overridden),
        sourceArtifactId: r.l_source_artifact_id,
      })),
    };
  }
  async linkDiagnostics(user: any, org: string, projectId: number) {
    await this.owner(user, org, projectId);
    const rows = await this.dataSource
      .getRepository(GithubLinkDiagnostic)
      .find({
        where: {
          organization_id: org,
          project_id: projectId,
          resolved_at: IsNull(),
        },
        order: { created_at: 'DESC' },
        take: 100,
      });
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        artifactType: row.artifact_type,
        source: row.source,
        reason: row.reason,
        token: row.token,
        createdAt: row.created_at,
      })),
    };
  }
  async unlinkTaskArtifact(
    user: any,
    org: string,
    taskId: number,
    artifactId: string,
  ) {
    const task = await this.tasks.findOne({
      where: { id: taskId, organization_id: org },
      relations: ['project'],
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.owner(user, org, task.project.id);
    const result = await this.links.update(
      { organization_id: org, task_id: taskId, artifact_id: artifactId },
      {
        state: 'suppressed',
        source: 'manual',
        created_by_user_id: Number(user.userId),
        manually_overridden: true,
      },
    );
    if (!result.affected)
      throw new NotFoundException('Development link not found');
    return { success: true };
  }
  async linkTaskArtifact(
    user: any,
    org: string,
    taskId: number,
    artifactUrl: string,
  ) {
    const task = await this.tasks.findOne({
      where: { id: taskId, organization_id: org },
      relations: ['project'],
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.authorization.assertProjectPermission(
      user,
      org,
      task.project.id,
      ProjectPermission.EDIT,
    );
    const artifact = await this.artifacts.findOne({
      where: {
        organization_id: org,
        project_id: task.project.id,
        url: artifactUrl.trim(),
      },
    });
    if (!artifact)
      throw new NotFoundException(
        'No received GitHub artifact with that URL exists in this project',
      );
    await this.links.upsert(
      {
        organization_id: org,
        project_id: task.project.id,
        artifact_id: artifact.id,
        task_id: task.id,
        state: 'active',
        source: 'manual',
        source_artifact_id: null,
        source_value: null,
        created_by_user_id: Number(user.userId),
        manually_overridden: true,
        first_delivery_id: artifact.last_delivery_id,
        last_delivery_id: artifact.last_delivery_id,
      },
      ['artifact_id', 'task_id'],
    );
    await this.dataSource.getRepository(GithubLinkDiagnostic).update(
      {
        connection_id: artifact.connection_id,
        artifact_provider_id: artifact.provider_id,
        resolved_at: IsNull(),
      },
      { resolved_at: new Date() },
    );
    return { success: true, data: { artifactId: artifact.id, taskId } };
  }
  async moveTaskArtifact(
    user: any,
    org: string,
    taskId: number,
    artifactId: string,
    targetTaskId: number,
  ) {
    const [source, target] = await Promise.all([
      this.tasks.findOne({
        where: { id: taskId, organization_id: org },
        relations: ['project'],
      }),
      this.tasks.findOne({
        where: { id: targetTaskId, organization_id: org },
        relations: ['project'],
      }),
    ]);
    if (!source || !target || source.project.id !== target.project.id)
      throw new BadRequestException(
        'Both tasks must belong to the same project',
      );
    await this.authorization.assertProjectPermission(
      user,
      org,
      source.project.id,
      ProjectPermission.EDIT,
    );
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(GithubTaskLink);
      const current = await repository.findOneBy({
        organization_id: org,
        task_id: taskId,
        artifact_id: artifactId,
      });
      if (!current) throw new NotFoundException('Development link not found');
      current.state = 'suppressed';
      current.source = 'manual';
      current.created_by_user_id = Number(user.userId);
      current.manually_overridden = true;
      await repository.save(current);
      await repository.upsert(
        {
          organization_id: org,
          project_id: source.project.id,
          artifact_id: artifactId,
          task_id: targetTaskId,
          state: 'active',
          source: 'manual',
          source_artifact_id: null,
          source_value: null,
          created_by_user_id: Number(user.userId),
          manually_overridden: true,
          first_delivery_id: current.first_delivery_id,
          last_delivery_id: current.last_delivery_id,
        },
        ['artifact_id', 'task_id'],
      );
    });
    return { success: true };
  }
  private valid(secret: string, signature: string, raw: Buffer) {
    const expected = Buffer.from(
      `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`,
    );
    const actual = Buffer.from(signature || '');
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }
  private safeExternalUrl(value: unknown, fallback: unknown) {
    for (const candidate of [value, fallback]) {
      try {
        const parsed = new URL(String(candidate || ''));
        if (parsed.protocol === 'https:') return parsed.toString();
      } catch {
        // Try the bounded fallback.
      }
    }
    return 'https://github.com/';
  }
  private providerTimestamp(value?: string) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  private taskReferences(value: string) {
    return [
      ...new Set(
        [...String(value || '').matchAll(/\bTP-(\d+)\b/gi)].map((match) =>
          Number(match[1]),
        ),
      ),
    ];
  }
  private references(
    fields: Array<{ value: unknown; source: string }>,
  ): Array<{ taskId: number; source: string; value: string }> {
    const found = new Map<
      number,
      { taskId: number; source: string; value: string }
    >();
    for (const field of fields) {
      const value = String(field.value || '');
      for (const match of value.matchAll(/\bTP-(\d+)\b/gi)) {
        const taskId = Number(match[1]);
        if (!found.has(taskId))
          found.set(taskId, {
            taskId,
            source: field.source,
            value: match[0].toUpperCase(),
          });
      }
    }
    return [...found.values()];
  }
  private assertAllowedSource(address?: string) {
    const configured = process.env.GITHUB_WEBHOOK_IP_ALLOWLIST?.trim();
    if (!configured) return;
    const candidate = String(address || '').replace(/^::ffff:/, '');
    const candidateFamily = isIP(candidate);
    if (!candidateFamily)
      throw new ForbiddenException('GitHub webhook source is not allowed');
    const blockList = new BlockList();
    for (const entry of configured.split(',').map((value) => value.trim())) {
      if (!entry) continue;
      const [network, prefixValue] = entry.split('/');
      const family = isIP(network);
      const prefix = Number(prefixValue);
      if (
        !family ||
        !Number.isInteger(prefix) ||
        prefix < 0 ||
        prefix > (family === 4 ? 32 : 128)
      )
        throw new Error(`Invalid GITHUB_WEBHOOK_IP_ALLOWLIST entry: ${entry}`);
      blockList.addSubnet(network, prefix, family === 4 ? 'ipv4' : 'ipv6');
    }
    if (!blockList.check(candidate, candidateFamily === 4 ? 'ipv4' : 'ipv6'))
      throw new ForbiddenException('GitHub webhook source is not allowed');
  }
  async supportHealth(organizationId?: string) {
    const connectionQ = this.connections.createQueryBuilder('c');
    const deliveryQ = this.deliveries
      .createQueryBuilder('d')
      .select('d.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .groupBy('d.state');
    if (organizationId) {
      connectionQ.where('c.organization_id=:organizationId', {
        organizationId,
      });
      deliveryQ.where('d.organization_id=:organizationId', { organizationId });
    }
    connectionQ.andWhere('c.archived_at IS NULL');
    const [connections, states] = await Promise.all([
      connectionQ
        .select('COUNT(*)', 'total')
        .addSelect('SUM(c.active)', 'active')
        .addSelect(
          "SUM(CASE WHEN c.health_state='silent' THEN 1 ELSE 0 END)",
          'silent',
        )
        .addSelect(
          "SUM(CASE WHEN c.health_state='failing' THEN 1 ELSE 0 END)",
          'failing',
        )
        .addSelect(
          "SUM(CASE WHEN c.health_state='pending' OR c.health_state='processing' THEN 1 ELSE 0 END)",
          'pending',
        )
        .getRawOne(),
      deliveryQ.getRawMany(),
    ]);
    return {
      success: true,
      data: {
        connections: {
          total: Number(connections?.total || 0),
          active: Number(connections?.active || 0),
          silent: Number(connections?.silent || 0),
          failing: Number(connections?.failing || 0),
          pending: Number(connections?.pending || 0),
        },
        deliveries: Object.fromEntries(
          states.map((row) => [row.state, Number(row.count)]),
        ),
      },
    };
  }
  private normalize(event: string, p: any): ArtifactInput[] {
    const allowedActions: Record<string, ReadonlySet<string>> = {
      issues: new Set(['opened', 'edited', 'closed', 'reopened', 'labeled']),
      pull_request: new Set([
        'opened',
        'synchronize',
        'ready_for_review',
        'closed',
        'reopened',
      ]),
      deployment_status: new Set(['created']),
      release: new Set(['published', 'released', 'edited', 'deleted']),
    };
    if (allowedActions[event] && !allowedActions[event].has(String(p.action)))
      return [];
    const actor = p.sender?.login;
    if (event === 'issues' && p.issue) {
      const refs = this.references([
        { value: p.issue.title, source: 'issue_title' },
        { value: p.issue.body, source: 'issue_body' },
      ]);
      return [
        {
          type: 'issue',
          providerId: String(p.issue.id),
          reference: `#${p.issue.number}`,
          title: p.issue.title,
          state: p.issue.state,
          url: p.issue.html_url,
          actor,
          updatedAt: p.issue.updated_at,
          taskIds: refs.map((ref) => ref.taskId),
          taskReferences: refs,
        },
      ];
    }
    if (event === 'pull_request' && p.pull_request) {
      const refs = this.references([
        { value: p.pull_request.title, source: 'pull_request_title' },
        { value: p.pull_request.body, source: 'pull_request_body' },
        { value: p.pull_request.head?.ref, source: 'branch_name' },
      ]);
      return [
        {
          type: 'pull_request',
          providerId: String(p.pull_request.id),
          reference: `#${p.pull_request.number}`,
          title: p.pull_request.title,
          state: p.pull_request.merged ? 'merged' : p.pull_request.state,
          url: p.pull_request.html_url,
          actor,
          updatedAt: p.pull_request.updated_at,
          metadata: { head_ref: p.pull_request.head?.ref || null },
          taskIds: refs.map((ref) => ref.taskId),
          taskReferences: refs,
        },
      ];
    }
    if (event === 'push')
      return (p.commits || []).slice(0, 100).map((c: any) => {
        const refs = this.references([
          { value: c.message, source: 'commit_message' },
        ]);
        return {
          type: 'commit',
          providerId: String(c.id),
          reference: String(c.id).slice(0, 7),
          title: String(c.message || '').slice(0, 500),
          state: 'pushed',
          url: c.url,
          actor: c.author?.username || c.author?.name,
          updatedAt: c.timestamp,
          metadata: {
            push_ref: String(p.ref || '').replace(/^refs\/heads\//, ''),
          },
          taskIds: refs.map((ref) => ref.taskId),
          taskReferences: refs,
        };
      });
    if (event === 'deployment_status' && p.deployment_status) {
      const refs = this.references([
        { value: p.deployment?.description, source: 'deployment_reference' },
        { value: p.deployment?.ref, source: 'deployment_reference' },
        { value: p.deployment?.environment, source: 'deployment_reference' },
      ]);
      return [
        {
          type: 'deployment',
          providerId: String(p.deployment?.id),
          reference: p.deployment?.environment,
          title:
            p.deployment?.description ||
            p.deployment?.environment ||
            'Deployment',
          state: p.deployment_status.state,
          url: p.deployment_status.target_url || p.repository?.html_url,
          actor,
          updatedAt: p.deployment_status.updated_at,
          metadata: { environment: p.deployment?.environment || null },
          taskIds: refs.map((ref) => ref.taskId),
          taskReferences: refs,
        },
      ];
    }
    if (event === 'release' && p.release) {
      const refs = this.references([
        { value: p.release.name, source: 'release_text' },
        { value: p.release.body, source: 'release_text' },
        { value: p.release.tag_name, source: 'release_text' },
      ]);
      return [
        {
          type: 'release',
          providerId: String(p.release.id),
          reference: p.release.tag_name,
          title: p.release.name || p.release.tag_name,
          state: p.action,
          url: p.release.html_url,
          actor,
          updatedAt:
            p.release.updated_at ||
            p.release.published_at ||
            p.release.created_at,
          taskIds: refs.map((ref) => ref.taskId),
          taskReferences: refs,
        },
      ];
    }
    return [];
  }
  private async reconcileRepository(c: GithubConnection, repository: any) {
    const providerId = String(repository?.id || '').trim();
    const fullName = String(repository?.full_name || '')
      .trim()
      .toLowerCase();
    if (!providerId || !/^[^/]+\/[^/]+$/.test(fullName))
      throw new BadRequestException('GitHub repository identity is required');
    if (c.provider_repository_id && c.provider_repository_id !== providerId)
      throw new BadRequestException('Repository does not match connection');
    if (
      c.provider_repository_id === providerId &&
      c.repository_full_name === fullName
    )
      return;
    const previousName = c.repository_full_name;
    try {
      await this.connections.update(c.id, {
        provider_repository_id: providerId,
        repository_full_name: fullName,
        repository_renamed_at:
          previousName === fullName ? c.repository_renamed_at : new Date(),
      });
    } catch {
      throw new ConflictException(
        'The renamed GitHub repository is already connected to this project',
      );
    }
    c.provider_repository_id = providerId;
    c.repository_full_name = fullName;
    if (previousName !== fullName)
      void this.notifyOwners(
        c,
        'GitHub repository connection renamed',
        `${previousName} is now ${fullName}. Tailpoint reconciled the signed webhook automatically.`,
        `github-rename:${c.id}:${fullName}`,
      ).catch(() => undefined);
  }
  private async enqueueDelivery(job: GithubDeliveryJob) {
    try {
      if (
        process.env.NODE_ENV === 'production' &&
        config.queue.driver !== 'redis'
      )
        throw new Error('Redis queue is required in production');
      if (config.queue.driver === 'redis') {
        if (!this.queue)
          throw new Error('GitHub delivery queue is unavailable');
        const jobId = `${job.connectionId}-${job.deliveryId}`.replace(
          /[^A-Za-z0-9_-]/g,
          '-',
        );
        const existingJob = await this.queue.getJob(jobId);
        if (existingJob) {
          if ((await existingJob.getState()) !== 'failed') return;
          await existingJob.remove();
        }
        await this.queue.add('process-github-delivery', job, {
          jobId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 500,
          removeOnFail: 500,
        });
        return;
      }
      setImmediate(() => void this.processDelivery(job).catch(() => undefined));
    } catch {
      await this.deliveries.update(
        {
          connection_id: job.connectionId,
          provider_delivery_id: job.deliveryId,
        },
        {
          state: 'failed',
          failure_code: 'queue_unavailable',
          processed_at: new Date(),
        },
      );
      await this.connections.update(job.connectionId, {
        last_delivery_state: 'failed',
        health_state: 'failing',
        consecutive_failures: () => 'consecutive_failures + 1',
      });
      await this.maybeAlertFailure(job.connectionId);
      throw new HttpException(
        'GitHub delivery queue is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
  private async notifyOwners(
    connection: GithubConnection,
    title: string,
    message: string,
    deliveryKey: string,
  ) {
    const ownerIds = await this.authorization.resolveProjectOwnerIds(
      connection.organization_id,
      connection.project_id,
    );
    await Promise.all(
      ownerIds.map((ownerId) =>
        this.notifications.enqueueNotification(
          {
            recipient: { id: ownerId } as any,
            sender: null,
            title,
            message,
            type: NOTIFICATION_TYPES.GITHUB_CONNECTION_HEALTH,
            metadata: {
              projectId: connection.project_id,
              connectionId: connection.id,
              repository: connection.repository_full_name,
              deliveryKey: `${deliveryKey}:${ownerId}`,
            },
          },
          connection.organization_id,
        ),
      ),
    );
  }
  private async maybeAlertFailure(connectionId: string) {
    const connection = await this.connections.findOneByOrFail({
      id: connectionId,
    });
    const threshold = Math.max(
      1,
      Number(process.env.GITHUB_FAILURE_ALERT_THRESHOLD || 3),
    );
    if (
      connection.consecutive_failures < threshold ||
      connection.health_alerted_at
    )
      return;
    const claimed = await this.connections.update(
      { id: connection.id, health_alerted_at: IsNull() },
      { health_alerted_at: new Date() },
    );
    if (claimed.affected)
      await this.notifyOwners(
        connection,
        'GitHub connection needs attention',
        `${connection.repository_full_name} has failed ${connection.consecutive_failures} consecutive delivery attempts.`,
        `github-failure:${connection.id}:${connection.consecutive_failures}`,
      ).catch(() => undefined);
  }
  @Cron(CronExpression.EVERY_HOUR)
  async monitorConnectionHealth() {
    const silenceHours = Math.max(
      1,
      Number(process.env.GITHUB_SILENCE_ALERT_HOURS || 168),
    );
    const cutoff = new Date(Date.now() - silenceHours * 60 * 60 * 1000);
    const silent = await this.connections
      .createQueryBuilder('c')
      .where('c.active=1 AND c.archived_at IS NULL')
      .andWhere('c.health_state <> :silent', { silent: 'silent' })
      .andWhere(
        '((c.last_delivery_at IS NOT NULL AND c.last_delivery_at < :cutoff) OR (c.last_delivery_at IS NULL AND c.created_at < :cutoff))',
        { cutoff },
      )
      .getMany();
    for (const connection of silent) {
      const claimed = await this.connections.update(
        { id: connection.id, health_state: connection.health_state },
        { health_state: 'silent', health_alerted_at: new Date() },
      );
      if (claimed.affected)
        await this.notifyOwners(
          connection,
          'GitHub connection is silent',
          `No webhook delivery has arrived from ${connection.repository_full_name} in ${silenceHours} hours. Check that the GitHub webhook is present and active.`,
          `github-silent:${connection.id}:${cutoff.toISOString().slice(0, 10)}`,
        ).catch(() => undefined);
    }
    const expiredRotations = await this.connections
      .createQueryBuilder('c')
      .where('c.active=1 AND c.archived_at IS NULL')
      .andWhere('c.previous_secret_expires_at IS NOT NULL')
      .andWhere('c.previous_secret_expires_at <= :now', { now: new Date() })
      .andWhere('c.rotation_alerted_at IS NULL')
      .andWhere('c.rotation_confirmed_at IS NULL')
      .getMany();
    for (const connection of expiredRotations) {
      const claimed = await this.connections.update(
        { id: connection.id, rotation_alerted_at: IsNull() },
        { rotation_alerted_at: new Date() },
      );
      if (claimed.affected)
        await this.notifyOwners(
          connection,
          'GitHub webhook secret overlap expired',
          `The old webhook secret for ${connection.repository_full_name} is no longer accepted. Confirm GitHub is using the new secret.`,
          `github-rotation-expired:${connection.id}`,
        ).catch(() => undefined);
    }
  }
  async receive(
    key: string,
    headers: Record<string, string>,
    body: any,
    raw?: Buffer,
    sourceIp?: string,
  ) {
    this.assertAllowedSource(sourceIp);
    const throttle = await this.throttler.increment(
      `webhook:${createHash('sha256')
        .update(`${key}:${sourceIp || 'unknown'}`)
        .digest('hex')
        .slice(0, 24)}`,
      config.rateLimit.ingestionWindowMs,
      config.rateLimit.ingestionMax,
      config.rateLimit.ingestionWindowMs,
      'github-webhook',
    );
    if (throttle.isBlocked)
      throw new HttpException(
        'Too many GitHub webhook requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    if (!raw || raw.length > 1_000_000)
      throw new PayloadTooLargeException(
        'Webhook payload is unavailable or too large',
      );
    const deliveryId = String(headers['x-github-delivery'] || '').slice(0, 100),
      event = String(headers['x-github-event'] || '').slice(0, 60),
      signature = String(headers['x-hub-signature-256'] || '');
    if (!deliveryId || !event)
      throw new BadRequestException('Missing GitHub delivery headers');
    const c = await this.connections
      .createQueryBuilder('c')
      .addSelect(['c.secret_ciphertext', 'c.previous_secret_ciphertext'])
      .where('c.webhook_key=:key', { key })
      .getOne();
    if (!c || !c.active)
      throw new NotFoundException('GitHub connection not found');
    const enabled = (
      await this.entitlements.resolveOrganization(c.organization_id)
    ).find((x) => x.key === CapabilityKey.GITHUB_INTEGRATION)?.enabled;
    if (!enabled) throw new NotFoundException('GitHub connection not found');
    const currentValid = this.valid(
      this.decrypt(c.secret_ciphertext),
      signature,
      raw,
    );
    const previousValid = Boolean(
      c.previous_secret_ciphertext &&
        c.previous_secret_expires_at &&
        c.previous_secret_expires_at > new Date() &&
        this.valid(this.decrypt(c.previous_secret_ciphertext), signature, raw),
    );
    if (!currentValid && !previousValid)
      throw new UnauthorizedException('Invalid GitHub signature');
    if (currentValid && c.previous_secret_ciphertext)
      await this.connections.update(c.id, {
        rotation_confirmed_at: new Date(),
      });
    await this.reconcileRepository(c, body.repository);
    try {
      await this.deliveries.insert({
        organization_id: c.organization_id,
        project_id: c.project_id,
        connection_id: c.id,
        provider_delivery_id: deliveryId,
        event,
        action: String(body.action || '').slice(0, 60) || null,
        state: 'queued',
        failure_code: null,
        artifact_count: 0,
        link_count: 0,
        received_at: new Date(),
        processed_at: null,
      });
    } catch (error) {
      const existing = await this.deliveries.findOne({
        where: { connection_id: c.id, provider_delivery_id: deliveryId },
      });
      if (!existing) throw error;
      if (existing.state === 'failed') {
        const reclaimed = await this.deliveries.update(
          { id: existing.id, state: 'failed' },
          {
            state: 'queued',
            failure_code: null,
            processed_at: null,
          },
        );
        if (reclaimed.affected) {
          existing.state = 'queued';
        } else {
          return {
            success: true,
            data: { deliveryId, state: existing.state, duplicate: true },
          };
        }
      } else if (existing.state !== 'queued') {
        return {
          success: true,
          data: { deliveryId, state: existing.state, duplicate: true },
        };
      }
    }
    const normalized = this.normalize(event, body);
    await this.connections.update(c.id, {
      last_delivery_at: new Date(),
      last_delivery_state: 'queued',
      health_state: 'processing',
    });
    await this.enqueueDelivery({
      connectionId: c.id,
      deliveryId,
      artifacts: normalized,
    });
    return {
      success: true,
      data: { deliveryId, state: 'queued', accepted: true },
    };
  }

  private async processDelivery(job: GithubDeliveryJob) {
    const { connectionId, deliveryId, artifacts: normalized } = job;
    const c = await this.connections.findOneByOrFail({ id: connectionId });
    const taskIds = [
      ...new Set(normalized.flatMap((artifact) => artifact.taskIds)),
    ];
    const validTasks = taskIds.length
      ? await this.tasks
          .createQueryBuilder('t')
          .where('t.id IN (:...ids)', { ids: taskIds })
          .andWhere('t.project_id=:projectId AND t.organization_id=:org', {
            projectId: c.project_id,
            org: c.organization_id,
          })
          .getMany()
      : [];
    let deliveryWasFailed = false;
    try {
      await this.dataSource.transaction(async (m) => {
        const d = await m.getRepository(GithubDelivery).findOneByOrFail({
          connection_id: c.id,
          provider_delivery_id: deliveryId,
        });
        deliveryWasFailed = d.state === 'failed';
        if (d.state === 'processed') return;
        let count = 0;
        for (const a of normalized) {
          const artifactValues = {
            organization_id: c.organization_id,
            project_id: c.project_id,
            connection_id: c.id,
            artifact_type: a.type,
            provider_id: a.providerId,
            reference: a.reference?.slice(0, 100) || null,
            title: a.title?.slice(0, 500) || null,
            state: a.state?.slice(0, 60) || null,
            url: this.safeExternalUrl(
              a.url,
              `https://github.com/${c.repository_full_name}`,
            ).slice(0, 2048),
            actor_label: a.actor?.slice(0, 160) || null,
            metadata: a.metadata || null,
            last_delivery_id: deliveryId,
            provider_updated_at: this.providerTimestamp(a.updatedAt),
          };
          const artifactRepository = m.getRepository(GithubArtifact);
          await artifactRepository
            .createQueryBuilder()
            .insert()
            .values(artifactValues)
            .orIgnore()
            .execute();
          if (artifactValues.provider_updated_at) {
            await artifactRepository
              .createQueryBuilder()
              .update()
              .set(artifactValues)
              .where(
                'connection_id=:connectionId AND artifact_type=:type AND provider_id=:providerId',
                {
                  connectionId: c.id,
                  type: a.type,
                  providerId: a.providerId,
                },
              )
              .andWhere(
                '(provider_updated_at IS NULL OR provider_updated_at < :providerUpdatedAt)',
                { providerUpdatedAt: artifactValues.provider_updated_at },
              )
              .execute();
          }
          const artifact = await m
            .getRepository(GithubArtifact)
            .findOneByOrFail({
              connection_id: c.id,
              artifact_type: a.type,
              provider_id: a.providerId,
            });
          if (artifact.last_delivery_id !== deliveryId) continue;
          await m.getRepository(GithubLinkDiagnostic).update(
            {
              connection_id: c.id,
              artifact_provider_id: a.providerId,
              resolved_at: IsNull(),
            },
            { resolved_at: new Date() },
          );
          const taskLinks = m.getRepository(GithubTaskLink);
          const references =
            a.taskReferences ??
            a.taskIds.map((taskId) => ({
              taskId,
              source: 'legacy_reference',
              value: `TP-${taskId}`,
            }));
          let plans = validTasks
            .filter((task) => a.taskIds.includes(task.id))
            .map((task) => ({
              taskId: task.id,
              source:
                references.find((reference) => reference.taskId === task.id)
                  ?.source ?? 'legacy_reference',
              value:
                references.find((reference) => reference.taskId === task.id)
                  ?.value ?? `TP-${task.id}`,
              sourceArtifactId: null as string | null,
            }));
          for (const reference of references.filter(
            (reference) =>
              !plans.some((plan) => plan.taskId === reference.taskId),
          )) {
            await m
              .getRepository(GithubLinkDiagnostic)
              .createQueryBuilder()
              .insert()
              .values({
                organization_id: c.organization_id,
                project_id: c.project_id,
                connection_id: c.id,
                delivery_id: deliveryId,
                artifact_provider_id: a.providerId,
                artifact_type: a.type,
                source: reference.source,
                reason: 'task_not_in_connected_project',
                token: reference.value,
                referenced_task_id: reference.taskId,
                resolved_at: null,
              })
              .orIgnore()
              .execute();
          }
          if (
            !references.length &&
            a.type === 'commit' &&
            a.metadata?.push_ref
          ) {
            const pullRequests = await m.getRepository(GithubArtifact).find({
              where: { connection_id: c.id, artifact_type: 'pull_request' },
            });
            const matchingPullRequests = pullRequests.filter(
              (candidate) =>
                candidate.state !== 'closed' &&
                candidate.metadata?.head_ref === a.metadata?.push_ref,
            );
            if (matchingPullRequests.length === 1) {
              const inherited = await taskLinks.find({
                where: {
                  artifact_id: matchingPullRequests[0].id,
                  state: 'active',
                },
              });
              plans = inherited.map((link) => ({
                taskId: link.task_id,
                source: 'inherited_pull_request',
                value: matchingPullRequests[0].reference || 'pull request',
                sourceArtifactId: matchingPullRequests[0].id,
              }));
            } else if (matchingPullRequests.length > 1) {
              await m
                .getRepository(GithubLinkDiagnostic)
                .createQueryBuilder()
                .insert()
                .values({
                  organization_id: c.organization_id,
                  project_id: c.project_id,
                  connection_id: c.id,
                  delivery_id: deliveryId,
                  artifact_provider_id: a.providerId,
                  artifact_type: a.type,
                  source: 'inherited_pull_request',
                  reason: 'ambiguous_pull_request_inheritance',
                  token: String(a.metadata.push_ref).slice(0, 40),
                  referenced_task_id: null,
                  resolved_at: null,
                })
                .orIgnore()
                .execute();
            }
          }
          const deleteLinks = taskLinks
            .createQueryBuilder()
            .delete()
            .where('artifact_id=:artifactId AND manually_overridden=0', {
              artifactId: artifact.id,
            });
          if (plans.length)
            deleteLinks.andWhere('task_id NOT IN (:...taskIds)', {
              taskIds: plans.map((plan) => plan.taskId),
            });
          await deleteLinks.execute();
          for (const plan of plans) {
            const existingLink = await taskLinks.findOneBy({
              artifact_id: artifact.id,
              task_id: plan.taskId,
            });
            if (existingLink?.manually_overridden) continue;
            await taskLinks
              .createQueryBuilder()
              .insert()
              .values({
                organization_id: c.organization_id,
                project_id: c.project_id,
                artifact_id: artifact.id,
                task_id: plan.taskId,
                state: 'active',
                source: plan.source,
                source_artifact_id: plan.sourceArtifactId,
                source_value: plan.value.slice(0, 255),
                created_by_user_id: null,
                manually_overridden: false,
                first_delivery_id: deliveryId,
                last_delivery_id: deliveryId,
              })
              .orIgnore()
              .execute();
            await taskLinks.update(
              { artifact_id: artifact.id, task_id: plan.taskId },
              {
                state: 'active',
                source: plan.source,
                source_artifact_id: plan.sourceArtifactId,
                source_value: plan.value.slice(0, 255),
                last_delivery_id: deliveryId,
              },
            );
            count++;
          }
        }
        d.link_count = count;
        d.artifact_count = normalized.length;
        d.state = 'processed';
        d.processed_at = new Date();
        await m.getRepository(GithubDelivery).save(d);
      });
    } catch (error) {
      await this.deliveries.update(
        { connection_id: c.id, provider_delivery_id: deliveryId },
        {
          state: 'failed',
          failure_code: 'processing_failed',
          processed_at: new Date(),
        },
      );
      if (!deliveryWasFailed) {
        await this.connections.update(c.id, {
          last_delivery_at: new Date(),
          last_delivery_state: 'failed',
          health_state: 'failing',
          consecutive_failures: () => 'consecutive_failures + 1',
        });
        await this.maybeAlertFailure(c.id);
      }
      throw error;
    }
    await this.connections.update(c.id, {
      last_delivery_at: new Date(),
      last_delivery_state: 'processed',
      health_state: 'healthy',
      consecutive_failures: 0,
      health_alerted_at: null,
    });
    return {
      success: true,
      data: { deliveryId, state: 'processed', artifacts: normalized.length },
    };
  }
}
