import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

export enum CapabilityKey {
  PERSONAL_PRODUCTIVITY_HUB = 'personal_productivity_hub',
  RECURRING_TASKS = 'recurring_tasks',
  STRUCTURED_PROJECT_UPDATES = 'structured_project_updates',
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
};
