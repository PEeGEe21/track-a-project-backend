import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProjectRole } from 'src/utils/constants/projectRole';
import {
  STANDARD_TRANSITION_FIELDS,
  StandardTransitionField,
} from '../workflow-contract';

export class WorkflowStatusDto {
  @IsInt() @Min(1) statusId: number;
  @IsString() @IsNotEmpty() @MaxLength(100) key: string;
  @IsInt() @Min(0) position: number;
  @IsBoolean() isInitial: boolean;
  @IsBoolean() isTerminal: boolean;
}

export class TransitionRequirementsDto {
  @IsOptional()
  @IsArray()
  @IsEnum(STANDARD_TRANSITION_FIELDS, { each: true })
  standardFields?: StandardTransitionField[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  customFieldIds?: string[];
}

export class WorkflowTransitionDto {
  @IsString() @IsNotEmpty() @MaxLength(180) key: string;
  @IsOptional() @IsString() @MaxLength(180) label?: string;
  @IsInt() @Min(1) sourceStatusId: number;
  @IsInt() @Min(1) destinationStatusId: number;
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ProjectRole, { each: true })
  allowedRoles: ProjectRole[];
  @IsOptional()
  @ValidateNested()
  @Type(() => TransitionRequirementsDto)
  requirements?: TransitionRequirementsDto;
}

export class UpdateWorkflowDraftDto {
  @IsOptional() @IsString() @MaxLength(180) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStatusDto)
  statuses: WorkflowStatusDto[];
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions: WorkflowTransitionDto[];
}

export class StatusMigrationDto {
  @IsInt() @Min(1) fromStatusId: number;
  @IsInt() @Min(1) toStatusId: number;
}

export class PublishWorkflowDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusMigrationDto)
  migrations?: StatusMigrationDto[];
}
