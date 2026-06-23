export const CLOSED_TASK_DEDUPE_BEHAVIORS = [
  'reopen',
  'create_new',
  'reopen_if_recent',
] as const;

export type ClosedTaskDedupeBehavior =
  (typeof CLOSED_TASK_DEDUPE_BEHAVIORS)[number];
