import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ReusableTemplateType } from 'src/typeorm/entities/ReusableTemplate';
export class CreateTemplateDto {
  @IsEnum(ReusableTemplateType) type: ReusableTemplateType;
  @IsString() @MaxLength(180) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsObject() snapshot: Record<string, unknown>;
}
export class CreateTemplateVersionDto {
  @IsObject() snapshot: Record<string, unknown>;
}
export class InstantiateTemplateDto {
  @IsOptional() @IsInt() @Min(1) targetProjectId?: number;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsObject() statusMappings?: Record<string, number>;
  @IsOptional() @IsObject() userMappings?: Record<string, number>;
  @IsOptional() @IsString() projectTitle?: string;
}
