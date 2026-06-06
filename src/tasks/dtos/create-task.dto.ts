import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  due_date?: Date;

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  due_date?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  assignees?: string;
}
