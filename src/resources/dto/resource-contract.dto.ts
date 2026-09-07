import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from 'src/common/openapi/api-contract.dto';

export class ResourceContractDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional({ nullable: true })
  url?: string | null;

  @ApiPropertyOptional({ nullable: true })
  mime_type?: string | null;

  @ApiPropertyOptional()
  file_size?: number;

  @ApiPropertyOptional()
  projectId?: number;

  @ApiPropertyOptional()
  taskId?: number;

  @ApiProperty({ format: 'uuid' })
  organization_id: string;
}

export class ResourceResponseDto {
  @ApiProperty({ type: ResourceContractDto })
  data: ResourceContractDto;

  @ApiPropertyOptional({ example: true })
  success?: boolean | string;
}

export class ResourceListResponseDto {
  @ApiProperty({ type: [ResourceContractDto] })
  data: ResourceContractDto[];

  @ApiPropertyOptional({ example: true })
  success?: boolean | string;

  @ApiPropertyOptional({ type: PaginationMetaDto })
  meta?: PaginationMetaDto;
}

export class PreviewUrlRequestDto {
  @ApiProperty({ format: 'uri' })
  url: string;
}
