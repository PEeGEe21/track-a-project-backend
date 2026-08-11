import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class WebhookCustomFieldMappingDto {
  @IsString() fieldId: string;
  @IsString() @MaxLength(255) path: string;
}
export class WebhookMappingDto {
  @IsString() @MaxLength(255) titlePath: string;
  @IsOptional() @IsString() @MaxLength(255) descriptionPath?: string;
  @IsOptional() @IsString() @MaxLength(255) severityPath?: string;
  @IsOptional() @IsString() @MaxLength(255) priorityPath?: string;
  @IsOptional() @IsString() @MaxLength(255) dedupeKeyPath?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => WebhookCustomFieldMappingDto)
  customFields?: WebhookCustomFieldMappingDto[];
}
export class CreateWebhookSourceDto {
  @IsString() @MaxLength(180) name: string;
  @ValidateNested() @Type(() => WebhookMappingDto) mapping: WebhookMappingDto;
}
export class UpdateWebhookSourceDto {
  @IsOptional() @IsString() @MaxLength(180) name?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookMappingDto)
  mapping?: WebhookMappingDto;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class RotateWebhookSecretDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  overlapMinutes?: number;
}
