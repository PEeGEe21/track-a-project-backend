import { IsIn, IsString, MaxLength } from 'class-validator';
export class CreateAiAssistanceDto {
  @IsIn([
    'rewrite_text',
    'summarize_text',
    'generate_checklist',
    'draft_project_update',
  ])
  featureId: string;
  @IsString() @MaxLength(20_000) input: string;
}
