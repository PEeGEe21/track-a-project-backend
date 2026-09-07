import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from 'src/common/openapi/api-contract.dto';

export class NotificationContractDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  message?: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  is_read: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata?: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  created_at: string;
}

export class NotificationResponseDto {
  @ApiProperty({ type: NotificationContractDto })
  data: NotificationContractDto;

  @ApiPropertyOptional({ example: true })
  success?: boolean | string;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationContractDto] })
  data: NotificationContractDto[];

  @ApiPropertyOptional({ example: true })
  success?: boolean | string;

  @ApiPropertyOptional({ type: PaginationMetaDto })
  meta?: PaginationMetaDto;
}
