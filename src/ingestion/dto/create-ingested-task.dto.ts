import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const INGESTION_SOURCES = ['sdk', 'api', 'sentry', 'manual'] as const;
export const INGESTION_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export type IngestionSource = (typeof INGESTION_SOURCES)[number];
export type IngestionSeverity = (typeof INGESTION_SEVERITIES)[number];

export class CreateIngestedTaskDto {
  @IsIn(INGESTION_SOURCES)
  source: IngestionSource;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  description_html?: string;

  @IsOptional()
  @IsIn(INGESTION_SEVERITIES)
  severity?: IngestionSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dedupeKey?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;
}
