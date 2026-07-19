import { Type } from 'class-transformer';
import {
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

export enum AssigneeMode {
  RETAIN = 'retain',
  UNASSIGNED = 'unassigned',
}
export enum WhiteboardTargetType {
  TASK = 'task',
  NOTE = 'note',
}

export class WhiteboardObjectMappingDto {
  @IsString() @IsNotEmpty() objectId: string;
  @IsEnum(WhiteboardTargetType) targetType: WhiteboardTargetType;
  @IsString() @IsNotEmpty() @MaxLength(255) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() statusId?: number;
  @IsOptional() @IsInt() assigneeId?: number;
  @IsOptional() @IsString() dueDate?: string;
}
export class ConvertWhiteboardDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhiteboardObjectMappingDto)
  objects: WhiteboardObjectMappingDto[];
  @IsOptional() @IsBoolean() confirmDuplicates = false;
}
export class CreateWorkflowStepDto {
  @IsInt() @Min(1) taskId: number;
  @IsString() @IsNotEmpty() @MaxLength(255) title: string;
  @IsOptional() @IsString() description?: string;
}
export class CreateWorkflowTemplateDto {
  @IsString() @IsNotEmpty() @MaxLength(180) name: string;
  @IsOptional() @IsString() description?: string;
  @IsArray() @IsInt({ each: true }) taskIds: number[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps?: CreateWorkflowStepDto[];
  @IsOptional() @IsBoolean() confirmDuplicates = false;
}
export class UpdateWorkflowTemplateDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(180) name?: string;
  @IsOptional() @IsString() description?: string;
}
export class SaveWorkflowDiagramDto {
  @IsArray() elements: Record<string, unknown>[];
  @IsOptional() appState?: Record<string, unknown>;
}
export class StepMappingDto {
  @IsUUID() stepId: string;
  @IsOptional() @IsString() @MaxLength(255) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() statusId?: number;
}
export class InstantiateWorkflowDto {
  @IsInt() @Min(1) projectId: number;
  @IsOptional() @IsString() startDate?: string;
  @IsEnum(AssigneeMode) assigneeMode: AssigneeMode;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepMappingDto)
  steps?: StepMappingDto[];
  @IsOptional() @IsBoolean() confirmDuplicates = false;
}
