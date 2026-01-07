import { IsString, IsOptional, IsBoolean, IsEnum, IsInt, IsUUID } from 'class-validator';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

export class UpdateGlobalMenuDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  href?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  order_index?: number;

  @IsOptional()
  @IsEnum(SubscriptionTier)
  required_tier?: SubscriptionTier;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}