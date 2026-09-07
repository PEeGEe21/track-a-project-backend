import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskDependencyContractDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  task_id: number;

  @ApiProperty()
  depends_on_task_id: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  depends_on_task?: Record<string, unknown>;
}

export class TaskDependencyListResponseDto {
  @ApiProperty({ type: [TaskDependencyContractDto] })
  data: TaskDependencyContractDto[];

  @ApiPropertyOptional({ example: true })
  success?: boolean | string;
}

export class TaskDependencyResponseDto {
  @ApiProperty({ type: TaskDependencyContractDto })
  data: TaskDependencyContractDto;

  @ApiPropertyOptional({ example: true })
  success?: boolean | string;
}

export class DependencyScheduleResponseDto {
  @ApiPropertyOptional()
  previewToken?: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  changes: Record<string, unknown>[];

  @ApiPropertyOptional({ type: [String] })
  warnings?: string[];
}
