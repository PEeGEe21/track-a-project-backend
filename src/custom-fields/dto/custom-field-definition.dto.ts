import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CustomFieldType, CustomFieldValue } from '../custom-field-type';

export class CustomFieldOptionDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]*$/)
  @MaxLength(80)
  key: string;

  @IsString()
  @MaxLength(120)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;
}

export class CreateCustomFieldDefinitionDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]*$/)
  @MaxLength(80)
  key: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsEnum(CustomFieldType)
  type: CustomFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  defaultValue?: CustomFieldValue;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CustomFieldOptionDto)
  options?: CustomFieldOptionDto[];
}

export class UpdateCustomFieldDefinitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(CustomFieldType)
  type?: CustomFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  defaultValue?: CustomFieldValue;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CustomFieldOptionDto)
  options?: CustomFieldOptionDto[];
}

export class ReorderCustomFieldItemDto {
  @IsString()
  id: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  position: number;
}

export class ReorderCustomFieldsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReorderCustomFieldItemDto)
  fields: ReorderCustomFieldItemDto[];
}
