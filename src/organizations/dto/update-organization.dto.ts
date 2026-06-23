import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  max_users: string;

  @IsOptional()
  max_projects: string;

  @IsOptional()
  @IsBoolean()
  is_active: boolean;

  @IsOptional()
  @IsBoolean()
  onboarding_complete: boolean;

  @IsOptional()
  @IsEnum(SubscriptionTier)
  subscription_tier: SubscriptionTier;

  @IsOptional()
  @IsBoolean()
  deadline_reminders_enabled?: boolean;

  @IsOptional()
  @IsNumber()
  deadline_reminder_days_before?: number;

  @IsOptional()
  @IsNumber()
  deadline_reminder_hour?: number;

  @IsOptional()
  @IsNumber()
  deadline_reminder_minute?: number;
}
