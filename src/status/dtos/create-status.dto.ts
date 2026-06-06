import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateStatusDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  tabId?: number;
}

export class UpdateStatusDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  tabId?: number;
}
