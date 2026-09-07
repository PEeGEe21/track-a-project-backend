import { IsDateString, IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDependencyDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dependsOnTaskId: number;
}

export class PreviewDependencyDatesDto {
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  dueDate: string;
}

export class ApplyDependencyDatesDto {
  @ApiProperty()
  @IsString()
  previewToken: string;
}
