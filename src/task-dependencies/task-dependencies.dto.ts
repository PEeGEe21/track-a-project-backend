import { IsDateString, IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDependencyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dependsOnTaskId: number;
}

export class PreviewDependencyDatesDto {
  @IsDateString()
  dueDate: string;
}

export class ApplyDependencyDatesDto {
  @IsString()
  previewToken: string;
}
