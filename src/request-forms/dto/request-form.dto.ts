import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  RequestFormInputType,
  RequestFormTargetType,
} from 'src/typeorm/entities/RequestFormField';
import { RequestFormVisibility } from 'src/typeorm/entities/RequestFormVersion';

export enum RequestFormConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  IS_SET = 'is_set',
  IS_NOT_SET = 'is_not_set',
}

export class RequestFormOptionDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]*$/)
  @MaxLength(80)
  key: string;
  @IsString() @IsNotEmpty() @MaxLength(120) label: string;
}

export class RequestFormConditionDto {
  @IsString() @MaxLength(80) fieldKey: string;
  @IsEnum(RequestFormConditionOperator)
  operator: RequestFormConditionOperator;
  @IsOptional() value?: unknown;
}

export class RequestFormFieldDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  @MaxLength(80)
  key: string;
  @IsString() @IsNotEmpty() @MaxLength(180) label: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsEnum(RequestFormInputType) inputType: RequestFormInputType;
  @IsEnum(RequestFormTargetType) targetType: RequestFormTargetType;
  @IsOptional() @IsString() @MaxLength(64) standardField?: string;
  @IsOptional() @IsUUID('4') customFieldId?: string;
  @IsBoolean() required: boolean;
  @Type(() => Number) @IsInt() @Min(0) position: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestFormOptionDto)
  options?: RequestFormOptionDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestFormConditionDto)
  conditions?: RequestFormConditionDto[];
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class RequestFormDefinitionDto {
  @IsString() @IsNotEmpty() @MaxLength(180) name: string;
  @IsString() @IsNotEmpty() @MaxLength(180) title: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsEnum(RequestFormVisibility) visibility: RequestFormVisibility;
  @Type(() => Number) @IsInt() @Min(1) destinationStatusId: number;
  @IsOptional() @IsString() @MaxLength(2000) confirmationText?: string;
  @IsOptional() @IsBoolean() requiresApproval?: boolean;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RequestFormFieldDto)
  fields: RequestFormFieldDto[];
}

export class ReviewRequestFormSubmissionDto {
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class SubmitRequestFormDto {
  @IsUUID('4') submissionId: string;
  @IsObject() answers: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(255) submitterEmail?: string;
  @IsOptional() @IsString() @MaxLength(0) website?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) renderedAt?: number;
}
