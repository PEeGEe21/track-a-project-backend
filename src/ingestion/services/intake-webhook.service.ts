import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { CustomFieldsService } from 'src/custom-fields/custom-fields.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { IntakeWebhookSource } from 'src/typeorm/entities/IntakeWebhookSource';
import { AuthUser } from 'src/types/users';
import { Repository } from 'typeorm';
import {
  CreateWebhookSourceDto,
  RotateWebhookSecretDto,
  UpdateWebhookSourceDto,
  WebhookMappingDto,
} from '../dto/intake-webhook.dto';
import { IngestionService } from './ingestion.service';

@Injectable()
export class IntakeWebhookService {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly entitlements: EntitlementsService,
    private readonly customFields: CustomFieldsService,
    private readonly ingestion: IngestionService,
    @InjectRepository(IntakeWebhookSource)
    private readonly sources: Repository<IntakeWebhookSource>,
  ) {}

  async list(actor: AuthUser, org: string, projectId: number) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const sources = await this.sources.find({
      where: { organization_id: org, project_id: projectId },
      order: { created_at: 'DESC' },
    });
    return sources.map((source) => this.safeSource(source));
  }

  async create(
    actor: AuthUser,
    org: string,
    projectId: number,
    dto: CreateWebhookSourceDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    this.validateMapping(dto.mapping);
    const secret = this.newSecret();
    const source = await this.sources.save(
      this.sources.create({
        organization_id: org,
        project_id: projectId,
        public_key: randomBytes(18).toString('base64url'),
        name: dto.name.trim(),
        secret_ciphertext: this.encrypt(secret),
        previous_secret_ciphertext: null,
        previous_secret_expires_at: null,
        mapping: dto.mapping as unknown as Record<string, unknown>,
        active: true,
        created_by_id: actor.userId,
      }),
    );
    return { ...this.safeSource(source), secret };
  }

  async update(
    actor: AuthUser,
    org: string,
    projectId: number,
    id: string,
    dto: UpdateWebhookSourceDto,
  ) {
    const source = await this.getManaged(actor, org, projectId, id);
    if (dto.mapping) {
      this.validateMapping(dto.mapping);
      source.mapping = dto.mapping as unknown as Record<string, unknown>;
    }
    if (dto.name !== undefined) source.name = dto.name.trim();
    if (dto.active !== undefined) source.active = dto.active;
    return this.safeSource(await this.sources.save(source));
  }

  async rotate(
    actor: AuthUser,
    org: string,
    projectId: number,
    id: string,
    dto: RotateWebhookSecretDto,
  ) {
    const source = await this.getManaged(actor, org, projectId, id);
    const overlap = dto.overlapMinutes ?? 15;
    source.previous_secret_ciphertext = overlap
      ? source.secret_ciphertext
      : null;
    source.previous_secret_expires_at = overlap
      ? new Date(Date.now() + overlap * 60000)
      : null;
    const secret = this.newSecret();
    source.secret_ciphertext = this.encrypt(secret);
    await this.sources.save(source);
    return { ...this.safeSource(source), secret };
  }

  async receive(
    publicKey: string,
    headers: Record<string, unknown>,
    payload: Record<string, unknown>,
    rawBody?: Buffer,
  ) {
    const source = await this.sources.findOne({
      where: { public_key: publicKey, active: true },
    });
    const timestamp = String(headers['x-tailpoint-timestamp'] ?? '');
    const signature = String(headers['x-tailpoint-signature'] ?? '');
    const deliveryId = String(headers['x-tailpoint-delivery'] ?? '').trim();
    const body = rawBody?.length
      ? rawBody
      : Buffer.from(JSON.stringify(payload));
    if (
      !source ||
      !deliveryId ||
      deliveryId.length > 255 ||
      !this.fresh(timestamp) ||
      !this.validSignature(source, timestamp, body, signature)
    ) {
      throw new UnauthorizedException('Webhook authentication failed');
    }
    const enabled = (
      await this.entitlements.resolveOrganization(source.organization_id)
    ).find((item) => item.key === CapabilityKey.UNIVERSAL_INTAKE)?.enabled;
    if (!enabled)
      throw new UnauthorizedException('Webhook authentication failed');
    const mapping = source.mapping as unknown as WebhookMappingDto;
    const title = String(this.at(payload, mapping.titlePath) ?? '').trim();
    if (!title)
      throw new BadRequestException('Mapped webhook title is required');
    const customFields = await this.customFields.prepareImportedValues(
      source.organization_id,
      source.project_id,
      (mapping.customFields ?? []).map((item) => ({
        fieldId: item.fieldId,
        value: this.at(payload, item.path),
      })),
    );
    const rawPriority = mapping.priorityPath
      ? this.at(payload, mapping.priorityPath)
      : undefined;
    const priority =
      rawPriority === undefined ? undefined : Number(rawPriority);
    const severity = mapping.severityPath
      ? String(this.at(payload, mapping.severityPath) ?? '').toLowerCase()
      : undefined;
    if (priority !== undefined && (!Number.isInteger(priority) || priority < 0))
      throw new BadRequestException('Mapped webhook priority is invalid');
    if (severity && !['low', 'medium', 'high', 'critical'].includes(severity))
      throw new BadRequestException('Mapped webhook severity is invalid');
    const processed = await this.ingestion.processWebhookEvent({
      organizationId: source.organization_id,
      projectId: source.project_id,
      sourceKey: `webhook:${source.id}`,
      idempotencyKey: deliveryId,
      dto: {
        source: 'api',
        title,
        description: mapping.descriptionPath
          ? String(this.at(payload, mapping.descriptionPath) ?? '')
          : undefined,
        severity: severity as any,
        priority,
        dedupeKey: mapping.dedupeKeyPath
          ? String(this.at(payload, mapping.dedupeKeyPath) ?? '').trim() ||
            undefined
          : undefined,
        customFields,
      },
    });
    return {
      accepted: true,
      eventId: processed.event.id,
      taskId: processed.outcome.taskId,
      idempotent: processed.idempotent,
    };
  }

  private async getManaged(
    actor: AuthUser,
    org: string,
    projectId: number,
    id: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const source = await this.sources.findOne({
      where: { id, organization_id: org, project_id: projectId },
    });
    if (!source) throw new NotFoundException('Webhook source not found');
    return source;
  }
  private safeSource(source: IntakeWebhookSource) {
    const {
      secret_ciphertext: _a,
      previous_secret_ciphertext: _b,
      ...safe
    } = source;
    return safe;
  }
  private validateMapping(mapping: WebhookMappingDto) {
    const paths = [
      mapping.titlePath,
      mapping.descriptionPath,
      mapping.severityPath,
      mapping.priorityPath,
      mapping.dedupeKeyPath,
      ...(mapping.customFields ?? []).map((item) => item.path),
    ].filter(Boolean) as string[];
    if (
      paths.some(
        (path) =>
          !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(path) ||
          path
            .split('.')
            .some((part) =>
              ['__proto__', 'prototype', 'constructor'].includes(part),
            ),
      )
    )
      throw new BadRequestException(
        'Webhook mappings must use safe dotted JSON paths',
      );
    const ids = (mapping.customFields ?? []).map((item) => item.fieldId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Custom Field mappings must be unique');
  }
  private at(payload: Record<string, unknown>, path: string) {
    let value: unknown = payload;
    for (const part of path.split('.')) {
      if (
        !value ||
        typeof value !== 'object' ||
        !Object.prototype.hasOwnProperty.call(value, part)
      )
        return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  }
  private fresh(value: string) {
    const timestamp = Number(value);
    return (
      Number.isInteger(timestamp) &&
      Math.abs(Date.now() - timestamp * 1000) <= 5 * 60 * 1000
    );
  }
  private validSignature(
    source: IntakeWebhookSource,
    timestamp: string,
    body: Buffer,
    provided: string,
  ) {
    const candidate = provided.startsWith('sha256=')
      ? provided.slice(7)
      : provided;
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    const secrets = [this.decrypt(source.secret_ciphertext)];
    if (
      source.previous_secret_ciphertext &&
      source.previous_secret_expires_at &&
      source.previous_secret_expires_at > new Date()
    )
      secrets.push(this.decrypt(source.previous_secret_ciphertext));
    return secrets.some((secret) =>
      timingSafeEqual(
        Buffer.from(candidate, 'hex'),
        Buffer.from(
          createHmac('sha256', secret)
            .update(timestamp)
            .update('.')
            .update(body)
            .digest('hex'),
          'hex',
        ),
      ),
    );
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
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return [
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }
  private decrypt(value: string) {
    const [iv, tag, encrypted] = value
      .split('.')
      .map((item) => Buffer.from(item, 'base64url'));
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
}
