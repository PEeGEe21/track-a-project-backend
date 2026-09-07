import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from 'src/common/openapi/api-contract.dto';
import { ProjectRole } from 'src/utils/constants/projectRole';

export class ProjectContractDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  description_html?: string | null;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  due_date?: string | null;

  @ApiProperty({ format: 'uuid' })
  organization_id: string;

  @ApiPropertyOptional({ format: 'date-time' })
  created_at?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  updated_at?: string;
}

export class ProjectResponseDto {
  @ApiProperty({ example: 'success' })
  success: boolean | string;

  @ApiProperty({ type: ProjectContractDto })
  data: ProjectContractDto;

  @ApiPropertyOptional()
  message?: string;
}

export class ProjectListResponseDto {
  @ApiProperty({ example: 'success' })
  success: boolean | string;

  @ApiProperty({ type: [ProjectContractDto] })
  data: ProjectContractDto[];

  @ApiPropertyOptional({ type: PaginationMetaDto })
  meta?: PaginationMetaDto;
}

export class ProjectOperationResponseDto {
  @ApiPropertyOptional({ example: 'success' })
  success?: boolean | string;

  @ApiPropertyOptional({
    oneOf: [
      { type: 'object', additionalProperties: true },
      { type: 'array', items: { type: 'object', additionalProperties: true } },
    ],
  })
  data?: Record<string, unknown> | Record<string, unknown>[];

  @ApiPropertyOptional()
  message?: string;
}

export class ProjectInviteRequestDto {
  @ApiProperty({ type: [String], format: 'email' })
  emails: string[];

  @ApiPropertyOptional({ enum: ProjectRole })
  role?: ProjectRole;
}
