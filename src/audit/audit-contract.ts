export const AUDIT_SCHEMA_VERSION = 2 as const;

export enum AuditActorType {
  HUMAN = 'human',
  AUTOMATION = 'automation',
  SYSTEM = 'system',
  ADMIN = 'admin',
}

export enum AuditOutcome {
  SUCCEEDED = 'succeeded',
  DENIED = 'denied',
  FAILED = 'failed',
}

export enum AuditSource {
  API = 'api',
  AUTOMATION = 'automation',
  SCHEDULER = 'scheduler',
  ADMIN = 'admin',
  MIGRATION = 'migration',
}

export enum AuditSubjectType {
  USER = 'user',
  ORGANIZATION = 'organization',
  PROJECT = 'project',
  TASK = 'task',
  WORKFLOW = 'workflow',
  REQUEST_FORM = 'request_form',
  REQUEST_SUBMISSION = 'request_submission',
  TEMPLATE = 'template',
  ENTITLEMENT = 'entitlement',
  AUTOMATION_RULE = 'automation_rule',
  AUTOMATION_RUN = 'automation_run',
  APPROVAL_REQUEST = 'approval_request',
  AI_SUGGESTION = 'ai_suggestion',
  AUDIT_EXPORT = 'audit_export',
  AUDIT_RETENTION_POLICY = 'audit_retention_policy',
}

export enum AuditAction {
  PROJECT_CREATED = 'project.created',
  PROJECT_UPDATED = 'project.updated',
  PROJECT_ARCHIVED = 'project.archived',
  PROJECT_DELETED = 'project.deleted',
  PROJECT_MEMBER_ROLE_CHANGED = 'project.member_role_changed',
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_ARCHIVED = 'task.archived',
  TASK_DELETED = 'task.deleted',
  TASK_ASSIGNED = 'task.assigned',
  TASK_STATUS_CHANGED = 'task.status_changed',
  WORKFLOW_CREATED = 'workflow.created',
  WORKFLOW_UPDATED = 'workflow.updated',
  WORKFLOW_PUBLISHED = 'workflow.published',
  REQUEST_FORM_CREATED = 'request_form.created',
  REQUEST_FORM_UPDATED = 'request_form.updated',
  REQUEST_FORM_PUBLISHED = 'request_form.published',
  REQUEST_FORM_ARCHIVED = 'request_form.archived',
  REQUEST_SUBMISSION_CREATED = 'request_submission.created',
  TEMPLATE_CREATED = 'template.created',
  TEMPLATE_UPDATED = 'template.updated',
  ENTITLEMENT_OVERRIDE_CHANGED = 'entitlement.override_changed',
  AUTOMATION_RULE_CREATED = 'automation_rule.created',
  AUTOMATION_RULE_UPDATED = 'automation_rule.updated',
  AUTOMATION_RULE_PUBLISHED = 'automation_rule.published',
  AUTOMATION_RULE_ENABLED = 'automation_rule.enabled',
  AUTOMATION_RULE_DISABLED = 'automation_rule.disabled',
  AUTOMATION_RULE_ARCHIVED = 'automation_rule.archived',
  AUTOMATION_RUN_COMPLETED = 'automation_run.completed',
  AUTOMATION_RUN_FAILED = 'automation_run.failed',
  AUTOMATION_RUN_RETRIED = 'automation_run.retried',
  APPROVAL_REQUEST_CREATED = 'approval_request.created',
  APPROVAL_RESPONSE_RECORDED = 'approval_response.recorded',
  APPROVAL_REQUEST_INVALIDATED = 'approval_request.invalidated',
  APPROVAL_REMINDER_SENT = 'approval_reminder.sent',
  AI_SUGGESTION_APPLIED = 'ai_suggestion.applied',
  AI_SUGGESTION_DISMISSED = 'ai_suggestion.dismissed',
  AUDIT_EXPORT_CREATED = 'audit_export.created',
  AUDIT_EXPORT_COMPLETED = 'audit_export.completed',
  AUDIT_EXPORT_DOWNLOADED = 'audit_export.downloaded',
  AUDIT_EXPORT_CANCELLED = 'audit_export.cancelled',
  AUDIT_EXPORT_EXPIRED = 'audit_export.expired',
  AUDIT_RETENTION_CHANGED = 'audit_retention.changed',
  AUDIT_ACCESS_DENIED = 'audit_access.denied',
  AUDIT_BREAK_GLASS_ACCESSED = 'audit_break_glass.accessed',
  USER_IMPERSONATED = 'user.impersonated',
  SUBSCRIPTION_CHANGED = 'subscription.changed',
}

export const AUDIT_LIMITS = Object.freeze({
  actorLabelLength: 160,
  subjectLabelLength: 200,
  stringLength: 500,
  objectKeys: 50,
  arrayItems: 50,
  depth: 5,
  metadataBytes: 16_384,
  listPageSize: 100,
  listRangeDays: 366,
  filterValues: 25,
  exportRows: 1_000_000,
  minimumRetentionDays: 30,
  defaultRetentionDays: 365,
} as const);

export type AuditActor = {
  type: AuditActorType;
  id?: string | number | null;
  label: string;
  responsibleUserId?: number | null;
};

export type AuditSubject = {
  type: AuditSubjectType;
  id?: string | number | null;
  label?: string | null;
};

export type AuditEventInput = {
  organizationId: string;
  projectId?: number | null;
  action: AuditAction;
  actor: AuditActor;
  subject: AuditSubject;
  source: AuditSource;
  outcome?: AuditOutcome;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
  correlationId: string;
  causationId?: string | null;
  sourceEventKey?: string | null;
  occurredAt?: Date;
};

export const AUDIT_EXPORT_FORMATS = ['csv', 'jsonl'] as const;
export type AuditExportFormat = (typeof AUDIT_EXPORT_FORMATS)[number];
