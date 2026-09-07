import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { CustomFieldValue } from 'src/custom-fields/custom-field-type';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductivityTaskView {
  MY_TASKS = 'my_tasks',
  TODAY = 'today',
  UPCOMING = 'upcoming',
  OVERDUE = 'overdue',
  WAITING_ON = 'waiting_on',
}

export enum ProductivityTaskSort {
  DUE_DATE = 'due_date',
  PRIORITY = 'priority',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  TITLE = 'title',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export enum CustomFieldFilterOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  CONTAINS = 'contains',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
}

export class CustomFieldFilterDto {
  @ApiProperty()
  @IsString()
  fieldId: string;

  @ApiProperty({ enum: CustomFieldFilterOperator })
  @IsEnum(CustomFieldFilterOperator)
  operator: CustomFieldFilterOperator;

  @ApiPropertyOptional()
  @Allow()
  value?: CustomFieldValue;
}

const parseCustomFieldFilters = ({ value }) => {
  if (value === undefined || value === '') return undefined;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const optionalInteger = () =>
  Transform(({ value }) =>
    value === undefined || value === '' ? undefined : Number(value),
  );

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ProductivityTaskQueryDto {
  @ApiPropertyOptional({
    enum: ProductivityTaskView,
    default: ProductivityTaskView.MY_TASKS,
  })
  @IsOptional()
  @IsEnum(ProductivityTaskView)
  view: ProductivityTaskView = ProductivityTaskView.MY_TASKS;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit = 25;

  @ApiPropertyOptional({
    enum: ProductivityTaskSort,
    default: ProductivityTaskSort.DUE_DATE,
  })
  @IsOptional()
  @IsEnum(ProductivityTaskSort)
  sort: ProductivityTaskSort = ProductivityTaskSort.DUE_DATE;

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.ASC })
  @IsOptional()
  @IsEnum(SortDirection)
  direction: SortDirection = SortDirection.ASC;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN)
  date?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @optionalInteger()
  @IsInt()
  @Min(1)
  project_id?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @optionalInteger()
  @IsInt()
  @Min(1)
  status_id?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @optionalInteger()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @optionalInteger()
  @IsInt()
  @Min(1)
  assignee_id?: number;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN)
  due_from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN)
  due_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: [CustomFieldFilterDto], maxItems: 20 })
  @IsOptional()
  @Transform(parseCustomFieldFilters)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CustomFieldFilterDto)
  custom_fields?: CustomFieldFilterDto[];
}
