import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class IntakeImportCustomFieldMappingDto {
  @IsString() fieldId: string;
  @IsString() @MaxLength(255) column: string;
}

export class ProcessIntakeImportDto {
  @IsString() @MaxLength(255) title: string;
  @IsOptional() @IsString() @MaxLength(255) description?: string;
  @IsOptional() @IsString() @MaxLength(255) severity?: string;
  @IsOptional() @IsString() @MaxLength(255) priority?: string;
  @IsOptional() @IsString() @MaxLength(255) dedupeKey?: string;
  @IsOptional() @IsString() @MaxLength(255) assignees?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => IntakeImportCustomFieldMappingDto)
  customFields?: IntakeImportCustomFieldMappingDto[];
}
