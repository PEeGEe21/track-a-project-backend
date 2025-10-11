import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { ResourceType } from 'src/utils/types';

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(ResourceType)
  @IsOptional()
  type?: ResourceType;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  projectId: number;

  @IsNumber()
  @IsOptional()
  taskId?: number;
}
