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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description_html?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ enum: TASK_SEVERITY_VALUES, nullable: true })
  @IsOptional()
  @Transform(transformSeverity)
  @IsString()
  @IsIn(TASK_SEVERITY_VALUES)
  severity?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @Transform(transformDueDate)
  @Type(() => Date)
  @IsDate()
  due_date?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: 'Comma-separated assignee emails.' })
  @IsOptional()
  @IsString()
  assignees?: string;

  @ApiPropertyOptional({ type: [TaskCustomFieldValueDto] })
  @IsOptional()
  @Transform(transformCustomFields)
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TaskCustomFieldValueDto)
  customFields?: TaskCustomFieldValueDto[];
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description_html?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ enum: TASK_SEVERITY_VALUES, nullable: true })
  @IsOptional()
  @Transform(transformSeverity)
  @IsString()
  @IsIn(TASK_SEVERITY_VALUES)
  severity?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @Transform(transformDueDate)
  @Type(() => Date)
  @IsDate()
  due_date?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: 'Comma-separated assignee emails.' })
  @IsOptional()
  @IsString()
  assignees?: string;

  @ApiPropertyOptional({ description: 'Comma-separated resource IDs.' })
  @IsOptional()
  @IsString()
  removeResourceIds?: string;

  @ApiPropertyOptional({ type: [TaskCustomFieldValueDto] })
  @IsOptional()
  @Transform(transformCustomFields)
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TaskCustomFieldValueDto)
  customFields?: TaskCustomFieldValueDto[];
}
