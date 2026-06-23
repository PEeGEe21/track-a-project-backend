import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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
}
