export enum AutomationTriggerType {
  TASK_CREATED = 'task.created',
  TASK_FIELD_CHANGED = 'task.field_changed',
  TASK_STATUS_CHANGED = 'task.status_changed',
  TASK_DEADLINE_REACHED = 'task.deadline_reached',
  TASK_INGESTED = 'task.ingested',
  FORM_SUBMITTED = 'form.submitted',
}

export const AUTOMATION_INGESTION_FIELDS = [
  'channel',
  'source',
  'outcome',
  'occurrence_count',
] as const;

export enum AutomationConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  IN = 'in',
  NOT_IN = 'not_in',
  IS_SET = 'is_set',
  IS_NOT_SET = 'is_not_set',
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  CHANGED_FROM = 'changed_from',
  CHANGED_TO = 'changed_to',
}

export enum AutomationActionType {
  ASSIGN = 'assign',
  UPDATE_FIELD = 'update_field',
  TRANSITION_STATUS = 'transition_status',
  ADD_WATCHER = 'add_watcher',
  NOTIFY = 'notify',
  CREATE_TASK_FROM_TEMPLATE = 'create_task_from_template',
}

export const AUTOMATION_STANDARD_FIELDS = [
  'title',
  'description',
  'priority',
  'severity',
  'due_date',
  'status_id',
  'assignee_ids',
] as const;

export const NO_VALUE_CONDITION_OPERATORS = new Set([
  AutomationConditionOperator.IS_SET,
  AutomationConditionOperator.IS_NOT_SET,
]);

export const CHANGE_CONDITION_OPERATORS = new Set([
  AutomationConditionOperator.CHANGED_FROM,
  AutomationConditionOperator.CHANGED_TO,
]);
