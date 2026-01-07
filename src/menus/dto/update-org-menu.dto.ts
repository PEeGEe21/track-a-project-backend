import { IsString, IsOptional, IsBoolean, IsEnum, IsInt, IsUUID } from 'class-validator';

export class UpdateOrgMenuDto {
  @IsBoolean()
  is_enabled: boolean;

  @IsOptional()
  @IsString()
  custom_label?: string;

  @IsOptional()
  @IsInt()
  order_index?: number;
}