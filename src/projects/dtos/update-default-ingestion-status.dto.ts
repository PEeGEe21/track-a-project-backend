import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class UpdateDefaultIngestionStatusDto {
  @Type(() => Number)
  @IsInt()
  default_ingestion_status_id: number;
}
