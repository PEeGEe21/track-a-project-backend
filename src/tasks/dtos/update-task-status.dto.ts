import { IsInt, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateTaskStatusDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  statusId: number; // new column (status) for the dragged task

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  sourceTaskIds?: number[]; // order of tasks in the column the task left

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  targetTaskIds?: number[]; // order of tasks in the column the task was dropped into
}
