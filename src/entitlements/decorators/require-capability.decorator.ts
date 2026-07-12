import { SetMetadata } from '@nestjs/common';
import { CapabilityKey } from '../capability-catalog';

export const REQUIRED_CAPABILITY = 'required_capability';
export const RequireCapability = (capability: CapabilityKey) =>
  SetMetadata(REQUIRED_CAPABILITY, capability);
