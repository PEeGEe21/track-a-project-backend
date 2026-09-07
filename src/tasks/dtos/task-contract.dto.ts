import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { PaginationMetaDto } from 'src/common/openapi/api-contract.dto';

export class TaskContractDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  description_html?: string | null;

  @ApiPropertyOptional()
  priority?: number;

  @ApiPropertyOptional({ nullable: true })
  severity?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  due_date?: string | null;

  @ApiProperty({ format: 'uuid' })
  organization_id: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  status?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  assignees?: Record<string, unknown>[];
}

export class TaskResponseDto {
  @ApiProperty({ example: 'success' })
  success: boolean | string;

  @ApiProperty({ type: TaskContractDto })
  data: TaskContractDto;
}

export class TaskListResponseDto {
  @ApiProperty({ example: 'success' })
  success: boolean | string;

  @ApiProperty({ type: [TaskContractDto] })
  data: TaskContractDto[];

  @ApiPropertyOptional({ type: PaginationMetaDto })
  meta?: PaginationMetaDto;
}

export class TaskOperationResponseDto {
  @ApiPropertyOptional({ example: 'success' })
  success?: boolean | string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  data?: Record<string, unknown>;

  @ApiPropertyOptional()
  message?: string;
}

export class ToggleTaskPriorityDto {
  @ApiProperty({ description: 'Current priority state to toggle.' })
  @IsBoolean()
  priority: boolean;
}
