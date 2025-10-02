import { IsInt, IsArray, IsOptional } from 'class-validator';

export class UpdateTaskStatusDto {
  @IsInt()
  statusId: number; // new column (status) for the dragged task

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  sourceTaskIds?: number[]; // order of tasks in the column the task left

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  targetTaskIds?: number[]; // order of tasks in the column the task was dropped into
}
