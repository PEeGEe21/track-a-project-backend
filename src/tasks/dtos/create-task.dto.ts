import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TaskCustomFieldValueDto } from 'src/custom-fields/dto/task-custom-field-values.dto';

const TASK_SEVERITY_VALUES = ['low', 'medium', 'high', 'critical'] as const;

const transformDueDate = ({ value }) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

const transformSeverity = ({ value }) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' ? value.trim().toLowerCase() : value;
};

const transformCustomFields = ({ value }) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  description_html?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @Transform(transformSeverity)
  @IsString()
  @IsIn(TASK_SEVERITY_VALUES)
  severity?: string | null;

  @IsOptional()
  @Transform(transformDueDate)
  @Type(() => Date)
  @IsDate()
  due_date?: Date | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  assignees?: string;

  @IsOptional()
  @Transform(transformCustomFields)
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TaskCustomFieldValueDto)
  customFields?: TaskCustomFieldValueDto[];
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  description_html?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @Transform(transformSeverity)
  @IsString()
  @IsIn(TASK_SEVERITY_VALUES)
  severity?: string | null;

  @IsOptional()
  @Transform(transformDueDate)
  @Type(() => Date)
  @IsDate()
  due_date?: Date | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  assignees?: string;

  @IsOptional()
  @IsString()
  removeResourceIds?: string;

  @IsOptional()
  @Transform(transformCustomFields)
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TaskCustomFieldValueDto)
  customFields?: TaskCustomFieldValueDto[];
}
