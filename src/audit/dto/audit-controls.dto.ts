import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ListAuditEventsDto } from './list-audit-events.dto';

export class CreateAuditExportDto extends ListAuditEventsDto {
  @IsIn(['csv', 'jsonl']) format: 'csv' | 'jsonl';
}
export class UpdateAuditRetentionDto {
  @Type(() => Number) @IsInt() @Min(30) @Max(3650) retentionDays: number;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') applyToExisting?: boolean;
}
export class BreakGlassDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason: string;
}
