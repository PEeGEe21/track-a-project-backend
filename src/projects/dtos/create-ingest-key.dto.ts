import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateIngestKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;
}
