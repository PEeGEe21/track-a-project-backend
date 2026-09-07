import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SavedTaskViewVisibility } from 'src/typeorm/entities/SavedTaskView';

export class CreateSavedTaskViewDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  configuration: Record<string, unknown>;

  @ApiPropertyOptional({ enum: SavedTaskViewVisibility })
  @IsOptional()
  @IsEnum(SavedTaskViewVisibility)
  visibility: SavedTaskViewVisibility = SavedTaskViewVisibility.PRIVATE;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_default = false;
}

export class UpdateSavedTaskViewDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: SavedTaskViewVisibility })
  @IsOptional()
  @IsEnum(SavedTaskViewVisibility)
  visibility?: SavedTaskViewVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
