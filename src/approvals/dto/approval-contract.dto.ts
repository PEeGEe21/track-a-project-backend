import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApprovalContractDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  project_id: number;

  @ApiProperty()
  subject_type: string;

  @ApiProperty()
  subject_id: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  due_at?: string | null;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  reviewers?: Record<string, unknown>[];
}

export class ApprovalResponseDto {
  @ApiProperty({ type: ApprovalContractDto })
  data: ApprovalContractDto;

  @ApiPropertyOptional({ example: true })
  success?: boolean | string;
}

export class ApprovalListResponseDto {
  @ApiProperty({ type: [ApprovalContractDto] })
  data: ApprovalContractDto[];

  @ApiPropertyOptional({ example: true })
  success?: boolean | string;
}
