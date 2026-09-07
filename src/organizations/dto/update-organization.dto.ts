import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  max_users: string;

  @ApiPropertyOptional()
  @IsOptional()
  max_projects: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onboarding_complete: boolean;

  @ApiPropertyOptional({ enum: SubscriptionTier })
  @IsOptional()
  @IsEnum(SubscriptionTier)
  subscription_tier: SubscriptionTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deadline_reminders_enabled?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsNumber()
  deadline_reminder_days_before?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 23 })
  @IsOptional()
  @IsNumber()
  deadline_reminder_hour?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 59 })
  @IsOptional()
  @IsNumber()
  deadline_reminder_minute?: number;
}
