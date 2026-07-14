import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { SavedTaskViewVisibility } from 'src/typeorm/entities/SavedTaskView';

export class CreateSavedTaskViewDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsObject()
  configuration: Record<string, unknown>;

  @IsOptional()
  @IsEnum(SavedTaskViewVisibility)
  visibility: SavedTaskViewVisibility = SavedTaskViewVisibility.PRIVATE;

  @IsOptional()
  @IsBoolean()
  is_default = false;
}

export class UpdateSavedTaskViewDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(SavedTaskViewVisibility)
  visibility?: SavedTaskViewVisibility;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
