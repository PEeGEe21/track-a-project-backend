import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

export enum CapabilityKey {
  PERSONAL_PRODUCTIVITY_HUB = 'personal_productivity_hub',
  RECURRING_TASKS = 'recurring_tasks',
  STRUCTURED_PROJECT_UPDATES = 'structured_project_updates',
  DECISION_REGISTER = 'decision_register',
  AI_ASSISTANCE = 'ai_assistance',
  CUSTOM_FIELDS = 'custom_fields',
  CUSTOM_WORKFLOWS = 'custom_workflows',
  MILESTONES = 'milestones',
  REQUEST_FORMS = 'request_forms',
  REUSABLE_TEMPLATES = 'reusable_templates',
  BASIC_APPROVALS = 'basic_approvals',
  UNIVERSAL_INTAKE = 'universal_intake',
}

export type CapabilityDefinition = {
  key: CapabilityKey;
  label: string;
  description: string;
  minimumTier: SubscriptionTier;
  defaultEnabled: boolean;
};

export const CAPABILITY_CATALOG: Record<CapabilityKey, CapabilityDefinition> = {
  [CapabilityKey.PERSONAL_PRODUCTIVITY_HUB]: {
    key: CapabilityKey.PERSONAL_PRODUCTIVITY_HUB,
    label: 'Personal Productivity Hub',
    description: 'Cross-project personal task views and saved filters.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.RECURRING_TASKS]: {
    key: CapabilityKey.RECURRING_TASKS,
    label: 'Recurring Tasks',
    description: 'Generate repeated task occurrences from reusable rules.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.STRUCTURED_PROJECT_UPDATES]: {
    key: CapabilityKey.STRUCTURED_PROJECT_UPDATES,
    label: 'Structured Project Updates',
    description: 'Draft, publish, and correct durable project status reports.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.DECISION_REGISTER]: {
    key: CapabilityKey.DECISION_REGISTER,
    label: 'Decision Register',
    description:
      'Record, approve, link, and supersede durable project decisions.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.AI_ASSISTANCE]: {
    key: CapabilityKey.AI_ASSISTANCE,
    label: 'AI Assistance Service',
    description: 'Secure, audited AI assistance infrastructure.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.CUSTOM_FIELDS]: {
    key: CapabilityKey.CUSTOM_FIELDS,
    label: 'Custom Fields',
    description: 'Project-defined typed fields for tasks and intake.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.CUSTOM_WORKFLOWS]: {
    key: CapabilityKey.CUSTOM_WORKFLOWS,
    label: 'Custom Workflows',
    description:
      'Versioned project status transitions with role and field requirements.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.MILESTONES]: {
    key: CapabilityKey.MILESTONES,
    label: 'Milestones',
    description:
      'Project outcomes with owners, target dates, health, and task-based progress.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.REQUEST_FORMS]: {
    key: CapabilityKey.REQUEST_FORMS,
    label: 'Forms and Request Intake',
    description:
      'Versioned public or organization forms that create validated project tasks.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.BASIC_APPROVALS]: {
    key: CapabilityKey.BASIC_APPROVALS,
    label: 'Basic Approvals',
    description:
      'Audited reviewer approvals for tasks, documents, and milestones.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.REUSABLE_TEMPLATES]: {
    key: CapabilityKey.REUSABLE_TEMPLATES,
    label: 'Reusable Templates',
    description:
      'Versioned task, checklist, and project snapshots with compatibility previews.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
  [CapabilityKey.UNIVERSAL_INTAKE]: {
    key: CapabilityKey.UNIVERSAL_INTAKE,
    label: 'Universal Intake',
    description:
      'Normalized, observable task intake across imports, webhooks, email, API, and SDK channels.',
    minimumTier: SubscriptionTier.FREE,
    defaultEnabled: false,
  },
};
