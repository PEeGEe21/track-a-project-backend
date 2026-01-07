import { IsString, IsOptional, IsBoolean, IsEnum, IsInt, IsUUID } from 'class-validator';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

export class CreateGlobalMenuDto {
  @IsString()
  label: string;

  @IsString()
  href: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @IsOptional()
  @IsInt()
  order_index?: number;

  @IsEnum(SubscriptionTier)
  required_tier: SubscriptionTier;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}