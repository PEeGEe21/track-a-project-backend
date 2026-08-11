import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewIntakeSuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
