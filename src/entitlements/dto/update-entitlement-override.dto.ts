import { IsBoolean, IsEnum } from 'class-validator';
import { CapabilityKey } from '../capability-catalog';

export class UpdateEntitlementOverrideDto {
  @IsEnum(CapabilityKey)
  capability: CapabilityKey;

  @IsBoolean()
  enabled: boolean;
}
