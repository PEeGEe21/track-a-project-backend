import { ProjectRole } from 'src/utils/constants/projectRole';

export enum WorkflowVersionState {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  RETIRED = 'retired',
}

export const TRANSITION_ROLES = [
  ProjectRole.CONTRIBUTOR,
  ProjectRole.EDITOR,
  ProjectRole.OWNER,
] as const;

export const STANDARD_TRANSITION_FIELDS = [
  'title',
  'description',
  'due_date',
  'priority',
  'severity',
  'assignees',
] as const;

export type StandardTransitionField =
  (typeof STANDARD_TRANSITION_FIELDS)[number];

export type TransitionRequirements = {
  standardFields?: StandardTransitionField[];
  customFieldIds?: string[];
};
