import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { normalizeRichTextDescription } from 'src/common/helpers/rich-text.helper';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { IntakeEmailAddress } from 'src/typeorm/entities/IntakeEmailAddress';
import { IntakeEmailAttachment } from 'src/typeorm/entities/IntakeEmailAttachment';
import { AuthUser } from 'src/types/users';
import { StorageService } from 'src/types/storage.interface';
import { Repository } from 'typeorm';
import {
  CreateIntakeEmailAddressDto,
  UpdateIntakeEmailAddressDto,
} from '../dto/intake-email.dto';
import { IngestionService } from './ingestion.service';
import { NormalizedIntakeService } from './normalized-intake.service';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Injectable()
export class IntakeEmailService {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly entitlements: EntitlementsService,
    private readonly normalized: NormalizedIntakeService,
    private readonly ingestion: IngestionService,
    @InjectRepository(IntakeEmailAddress)
    private readonly addresses: Repository<IntakeEmailAddress>,
    @InjectRepository(IntakeEmailAttachment)
    private readonly attachments: Repository<IntakeEmailAttachment>,
    @Inject('STORAGE_SERVICE') private readonly storage: StorageService,
  ) {}

  async list(actor: AuthUser, org: string, projectId: number) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    return (
      await this.addresses.find({
        where: { organization_id: org, project_id: projectId },
        order: { created_at: 'DESC' },
      })
    ).map((item) => this.safe(item));
  }
  async create(
    actor: AuthUser,
    org: string,
    projectId: number,
    dto: CreateIntakeEmailAddressDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const address = await this.addresses.save(
      this.addresses.create({
        organization_id: org,
        project_id: projectId,
        token: randomBytes(24).toString('base64url').toLowerCase(),
        name: dto.name.trim(),
        active: true,
        spam_threshold: dto.spamThreshold ?? 5,
        created_by_id: actor.userId,
      }),
    );
    return this.safe(address);
  }
  async update(
    actor: AuthUser,
    org: string,
    projectId: number,
    id: string,
    dto: UpdateIntakeEmailAddressDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const address = await this.addresses.findOne({
      where: { id, organization_id: org, project_id: projectId },
    });
    if (!address) throw new BadRequestException('Inbound address not found');
    if (dto.name !== undefined) address.name = dto.name.trim();
    if (dto.active !== undefined) address.active = dto.active;
    if (dto.spamThreshold !== undefined)
      address.spam_threshold = dto.spamThreshold;
    return this.safe(await this.addresses.save(address));
  }
  async rotate(actor: AuthUser, org: string, projectId: number, id: string) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const address = await this.addresses.findOne({
      where: { id, organization_id: org, project_id: projectId },
    });
    if (!address) throw new BadRequestException('Inbound address not found');
    address.token = randomBytes(24).toString('base64url').toLowerCase();
    address.active = true;
    return this.safe(await this.addresses.save(address));
  }

  async receive(
    auth: string | undefined,
    fields: Record<string, unknown>,
    files: Express.Multer.File[],
  ) {
    this.verifyProvider(auth);
    const recipient = this.recipient(fields.envelope, fields.to);
    const token = recipient.split('@')[0]?.toLowerCase();
    const address = token
      ? await this.addresses.findOne({ where: { token, active: true } })
      : null;
    if (!address) return { accepted: false };
    const capability = (
      await this.entitlements.resolveOrganization(address.organization_id)
    ).find((item) => item.key === CapabilityKey.UNIVERSAL_INTAKE);
    if (!capability?.enabled) return { accepted: false };
    const messageId = this.messageId(String(fields.headers ?? ''));
    if (!messageId)
      throw new BadRequestException('Email message ID is required');
    const subject =
      String(fields.subject ?? '')
        .trim()
        .slice(0, 255) || 'Email request';
    const sanitized = normalizeRichTextDescription({
      description: String(fields.text ?? ''),
      description_html: String(fields.html ?? ''),
    });
    const received = await this.normalized.receive({
      organizationId: address.organization_id,
      projectId: address.project_id,
      channel: 'email',
      sourceKey: `email-address:${address.id}`,
      idempotencyKey: messageId.slice(0, 255),
      normalizedPayload: {
        title: subject,
        description: sanitized?.description ?? '',
        description_html: sanitized?.description_html ?? null,
        sender: this.sender(String(fields.from ?? '')),
        spamScore: Number(fields.spam_score ?? 0),
      },
    });
    if (received.idempotent && received.event.state === 'accepted')
      return {
        accepted: true,
        eventId: received.event.id,
        taskId: received.event.task_id,
        idempotent: true,
      };
    const spamScore = Number(fields.spam_score ?? 0);
    if (
      Number.isFinite(spamScore) &&
      spamScore > Number(address.spam_threshold)
    ) {
      await this.normalized.retainDisposition(
        received.event,
        'quarantined',
        'spam_threshold',
        'Email exceeded the configured spam threshold',
      );
      return { accepted: false, eventId: received.event.id, quarantined: true };
    }
    await this.storeAttachments(received.event.id, address.project_id, files);
    const processed = await this.ingestion.processReceivedEmailEvent(
      received.event,
      {
        source: 'api',
        title: subject,
        description: sanitized?.description,
        description_html: sanitized?.description_html ?? undefined,
      },
    );
    return {
      accepted: true,
      eventId: processed.event.id,
      taskId: processed.outcome.taskId,
      idempotent: received.idempotent || processed.idempotent,
    };
  }

  private async storeAttachments(
    eventId: string,
    projectId: number,
    files: Express.Multer.File[],
  ) {
    for (const file of files.slice(0, 10)) {
      const digest = createHash('sha256').update(file.buffer).digest('hex');
      const allowed =
        file.size <= 10 * 1024 * 1024 && ALLOWED_MIME.has(file.mimetype);
      const storageKey = allowed
        ? await this.storage.uploadFile(
            file as any,
            `intake/email/${projectId}/${eventId}/${randomBytes(12).toString(
              'hex',
            )}`,
          )
        : `rejected:${digest}`;
      await this.attachments.save(
        this.attachments.create({
          event_id: eventId,
          original_name: file.originalname.slice(0, 255),
          storage_key: storageKey,
          mime_type: file.mimetype.slice(0, 180),
          size_bytes: file.size,
          sha256: digest,
          status: allowed ? 'quarantined' : 'rejected',
        }),
      );
    }
  }
  private verifyProvider(value?: string) {
    const expected = process.env.SENDGRID_INBOUND_ACCESS_TOKEN || '';
    const actual = value?.replace(/^Bearer\s+/i, '') ?? '';
    if (
      !expected ||
      expected.length !== actual.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
    )
      throw new UnauthorizedException('Email provider authentication failed');
  }
  private recipient(envelope: unknown, fallback: unknown) {
    try {
      const parsed =
        typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
      const to = (parsed as any)?.to;
      if (Array.isArray(to) && to[0]) return String(to[0]);
    } catch {}
    return String(fallback ?? '');
  }
  private messageId(headers: string) {
    return headers.match(/^Message-ID:\s*(.+)$/im)?.[1]?.trim() ?? null;
  }
  private sender(value: string) {
    return value.replace(/[\r\n]/g, ' ').slice(0, 255);
  }
  private safe(item: IntakeEmailAddress) {
    return {
      ...item,
      address: `${item.token}@${
        process.env.INBOUND_EMAIL_DOMAIN || 'inbound.local'
      }`,
    };
  }
}
