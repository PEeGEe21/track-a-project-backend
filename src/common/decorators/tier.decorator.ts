import { SetMetadata } from '@nestjs/common';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

export const RequireTier = (tier: SubscriptionTier) =>
  SetMetadata('tier', tier);
