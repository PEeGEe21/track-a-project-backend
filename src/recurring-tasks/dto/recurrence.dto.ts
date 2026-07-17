import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  RecurrenceFrequency,
  RecurrenceGenerationMode,
} from 'src/typeorm/entities/TaskRecurrence';

export class CreateRecurrenceDto {
  @Type(() => Number) @IsInt() @Min(1) template_task_id: number;
  @IsEnum(RecurrenceFrequency) frequency: RecurrenceFrequency;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) interval = 1;
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];
  @IsString() timezone: string;
  @IsEnum(RecurrenceGenerationMode) generation_mode: RecurrenceGenerationMode;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) generate_before_days = 0;
  @Type(() => Date) @IsDate() next_due_at: Date;
  @IsOptional() @Type(() => Date) @IsDate() end_at?: Date;
}

export class UpdateRecurrenceDto {
  @IsOptional() @IsEnum(RecurrenceFrequency) frequency?: RecurrenceFrequency;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) interval?: number;
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];
  @IsOptional() @IsString() timezone?: string;
  @IsOptional()
  @IsEnum(RecurrenceGenerationMode)
  generation_mode?: RecurrenceGenerationMode;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  generate_before_days?: number;
  @IsOptional() @Type(() => Date) @IsDate() next_due_at?: Date;
  @IsOptional() @Type(() => Date) @IsDate() end_at?: Date;
  @IsOptional() @IsBoolean() active?: boolean;
}
