import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { EntityManager } from 'typeorm';
import {
  AUDIT_LIMITS,
  AUDIT_SCHEMA_VERSION,
  AuditEventInput,
  AuditOutcome,
} from './audit-contract';
import { AuditPayloadSanitizer } from './audit-payload-sanitizer';
import { AuditRequestContextService } from './audit-request-context.service';
import { AuditRetentionPolicy } from 'src/typeorm/entities/AuditRetentionPolicy';

@Injectable()
export class AuditWriterService {
  constructor(
    private readonly sanitizer: AuditPayloadSanitizer,
    private readonly requestContext: AuditRequestContextService,
  ) {}

  correlationId() {
    return this.requestContext.correlationId();
  }

  /**
   * Append using the mutation's EntityManager. Callers must pass the manager
   * from their active transaction; this service never opens a second transaction.
   */
  async append(
    manager: EntityManager,
    input: AuditEventInput,
  ): Promise<string> {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error(
        'AuditWriterService.append requires an active database transaction',
      );
    }
    const repository = manager.getRepository(AuditLog);
    const id = randomUUID();
    const occurredAt = input.occurredAt ?? new Date();
    const sourceEventKey = input.sourceEventKey?.slice(0, 80) ?? null;
    const retentionExpiresAt = new Date(occurredAt);
    const policy = await manager.getRepository(AuditRetentionPolicy).findOne({
      where: { organization_id: input.organizationId },
    });
    retentionExpiresAt.setUTCDate(
      retentionExpiresAt.getUTCDate() + (policy?.retention_days ?? AUDIT_LIMITS.defaultRetentionDays),
    );

    const row = repository.create({
      id,
      schema_version: AUDIT_SCHEMA_VERSION,
      organization_id: input.organizationId,
      project_id: input.projectId ?? null,
      action: input.action,
      actor_type: input.actor.type,
      actor_id:
        input.actor.id === undefined || input.actor.id === null
          ? null
          : String(input.actor.id),
      actor_label: input.actor.label.slice(0, AUDIT_LIMITS.actorLabelLength),
      responsible_user_id: input.actor.responsibleUserId ?? null,
      subject_type: input.subject.type,
      subject_id:
        input.subject.id === undefined || input.subject.id === null
          ? null
          : String(input.subject.id),
      subject_label:
        input.subject.label?.slice(0, AUDIT_LIMITS.subjectLabelLength) ?? null,
      source: input.source,
      outcome: input.outcome ?? AuditOutcome.SUCCEEDED,
      before_changes: this.sanitizer.sanitizeChanges(
        input.subject.type,
        input.before,
      ),
      after_changes: this.sanitizer.sanitizeChanges(
        input.subject.type,
        input.after,
      ),
      metadata: this.sanitizer.sanitizeMetadata(input.metadata),
      request_id:
        (input.requestId ?? this.requestContext.current?.()?.requestId)?.slice(
          0,
          80,
        ) ?? null,
      correlation_id: input.correlationId.slice(0, 80),
      causation_id: input.causationId?.slice(0, 80) ?? null,
      source_event_key: sourceEventKey,
      occurred_at: occurredAt,
      retention_expires_at: retentionExpiresAt,
      admin_id: null,
      target_user_id: null,
    });

    try {
      await repository.insert(row);
      return id;
    } catch (error) {
      if (!sourceEventKey || !this.isDuplicateKey(error)) throw error;
      const existing = await repository.findOne({
        select: { id: true },
        where: {
          organization_id: input.organizationId,
          source: input.source,
          source_event_key: sourceEventKey,
        },
      });
      if (!existing) throw error;
      return existing.id;
    }
  }

  private isDuplicateKey(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: string; errno?: number };
    return candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062;
  }
}
