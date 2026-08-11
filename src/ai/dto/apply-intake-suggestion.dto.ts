import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional } from 'class-validator';

export const INTAKE_AI_APPLY_FIELDS = [
  'title',
  'category',
  'priority',
  'duplicateTaskId',
  'assigneeId',
  'destinationProjectId',
] as const;

export class ApplyIntakeSuggestionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(INTAKE_AI_APPLY_FIELDS, { each: true })
  fields: Array<(typeof INTAKE_AI_APPLY_FIELDS)[number]>;

  @IsOptional()
  @IsBoolean()
  confirmRouting?: boolean;

  @IsOptional()
  @IsBoolean()
  confirmDuplicateMerge?: boolean;
}
