import { IsInt, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTaskStatusDto {
  @ApiProperty()
  @IsInt()
  statusId: number; // new column (status) for the dragged task

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  sourceTaskIds?: number[]; // order of tasks in the column the task left

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  targetTaskIds?: number[]; // order of tasks in the column the task was dropped into
}
