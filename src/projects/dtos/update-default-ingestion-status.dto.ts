import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { CLOSED_TASK_DEDUPE_BEHAVIORS } from 'src/ingestion/constants/closed-task-dedupe-behavior';

export class UpdateDefaultIngestionStatusDto {
  @Type(() => Number)
  @IsInt()
  default_ingestion_status_id: number;

  @IsOptional()
  @IsIn(CLOSED_TASK_DEDUPE_BEHAVIORS)
  ingestion_closed_task_dedupe_behavior?:
    | 'reopen'
    | 'create_new'
    | 'reopen_if_recent';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  closed_task_reopen_window_days?: number;
}
