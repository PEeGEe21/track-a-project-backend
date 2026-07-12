import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

export enum CapabilityKey {
  PERSONAL_PRODUCTIVITY_HUB = 'personal_productivity_hub',
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
};
