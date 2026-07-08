import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProjectStatusTemplateItemDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tabId?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isTerminal?: boolean;
}

export class UpdateProjectStatusTemplatesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectStatusTemplateItemDto)
  statuses: ProjectStatusTemplateItemDto[];
}
