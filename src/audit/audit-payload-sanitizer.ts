import { Injectable } from '@nestjs/common';
import { AUDIT_LIMITS, AuditSubjectType } from './audit-contract';

const DENIED_KEY =
  /(^|_)(password|passcode|secret|token|cookie|authorization|credential|private_key|api_key|signed_url|raw_body|body|content|message|attachment|file)(_|$)/i;

export const AUDIT_FIELD_ALLOWLISTS: Record<
  AuditSubjectType,
  ReadonlySet<string>
> = {
  [AuditSubjectType.USER]: new Set(['status', 'role', 'organization_role']),
  [AuditSubjectType.ORGANIZATION]: new Set([
    'name',
    'status',
    'subscription_tier',
  ]),
  [AuditSubjectType.PROJECT]: new Set([
    'name',
    'status',
    'owner_id',
    'archived_at',
  ]),
  [AuditSubjectType.TASK]: new Set([
    'title',
    'status_id',
    'priority',
    'assignee_ids',
    'due_date',
    'archived_at',
    'custom_fields_changed',
  ]),
  [AuditSubjectType.WORKFLOW]: new Set(['name', 'version', 'status']),
  [AuditSubjectType.REQUEST_FORM]: new Set([
    'name',
    'status',
    'version',
    'visibility',
  ]),
  [AuditSubjectType.REQUEST_SUBMISSION]: new Set([
    'status',
    'form_id',
    'created_task_id',
  ]),
  [AuditSubjectType.TEMPLATE]: new Set([
    'name',
    'status',
    'version',
    'template_type',
  ]),
  [AuditSubjectType.ENTITLEMENT]: new Set(['capability', 'enabled']),
  [AuditSubjectType.AUTOMATION_RULE]: new Set([
    'name',
    'status',
    'version',
    'enabled',
  ]),
  [AuditSubjectType.AUTOMATION_RUN]: new Set([
    'status',
    'rule_id',
    'action_count',
    'reason',
  ]),
  [AuditSubjectType.APPROVAL_REQUEST]: new Set([
    'status',
    'subject_type',
    'subject_id',
    'reviewer_count',
    'decision',
    'reason',
  ]),
  [AuditSubjectType.AI_SUGGESTION]: new Set([
    'status',
    'field_count',
    'created_task_id',
  ]),
  [AuditSubjectType.AUDIT_EXPORT]: new Set([
    'format',
    'status',
    'row_count',
    'expires_at',
  ]),
  [AuditSubjectType.AUDIT_RETENTION_POLICY]: new Set([
    'retention_days',
    'effective_at',
  ]),
  [AuditSubjectType.INTEGRATION_ENDPOINT]: new Set([
    'name',
    'active',
    'project_id',
    'action_count',
  ]),
  [AuditSubjectType.INTEGRATION_DELIVERY]: new Set([
    'status',
    'generation',
    'attempt_count',
    'event_id',
  ]),
  [AuditSubjectType.TASK_DEPENDENCY]: new Set([
    'task_id',
    'depends_on_task_id',
    'active',
    'removal_reason',
    'date_change_count',
  ]),
};

@Injectable()
export class AuditPayloadSanitizer {
  sanitizeChanges(
    subjectType: AuditSubjectType,
    value?: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!value) return null;
    const allowlist = AUDIT_FIELD_ALLOWLISTS[subjectType];
    const entries = Object.entries(value)
      .filter(([key]) => allowlist.has(key) && !DENIED_KEY.test(key))
      .slice(0, AUDIT_LIMITS.objectKeys)
      .map(([key, item]) => [key, this.sanitizeValue(item, 1)] as const)
      .filter((entry) => entry[1] !== undefined);
    return Object.fromEntries(entries);
  }

  sanitizeMetadata(
    value?: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!value) return null;
    const sanitized = this.sanitizeValue(value, 0);
    if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized))
      return null;
    const serialized = JSON.stringify(sanitized);
    if (Buffer.byteLength(serialized, 'utf8') <= AUDIT_LIMITS.metadataBytes)
      return sanitized as Record<string, unknown>;
    return { truncated: true };
  }

  private sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > AUDIT_LIMITS.depth) return '[depth-limited]';
    if (
      value === null ||
      typeof value === 'boolean' ||
      typeof value === 'number'
    )
      return value;
    if (typeof value === 'string')
      return value.slice(0, AUDIT_LIMITS.stringLength);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      return value
        .slice(0, AUDIT_LIMITS.arrayItems)
        .map((item) => this.sanitizeValue(item, depth + 1));
    }
    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !DENIED_KEY.test(key))
          .slice(0, AUDIT_LIMITS.objectKeys)
          .map(([key, item]) => [key, this.sanitizeValue(item, depth + 1)]),
      );
    }
    return undefined;
  }
}
