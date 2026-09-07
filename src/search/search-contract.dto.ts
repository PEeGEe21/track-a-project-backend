import { ApiProperty } from '@nestjs/swagger';

export class SearchResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  snippet: string;

  @ApiProperty()
  href: string;

  @ApiProperty({ type: 'object', additionalProperties: true, required: false })
  project?: Record<string, unknown>;

  @ApiProperty({ format: 'date-time', required: false })
  updatedAt?: string;
}

export class GlobalSearchResponseDto {
  @ApiProperty()
  query: string;

  @ApiProperty({ type: [SearchResultDto] })
  results: SearchResultDto[];

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  counts: Record<string, number>;
}
