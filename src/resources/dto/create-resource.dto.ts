import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { ResourceType } from 'src/utils/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateResourceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ enum: ResourceType })
  @IsEnum(ResourceType)
  @IsOptional()
  type?: ResourceType;

  @ApiPropertyOptional({ format: 'uri' })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  projectId: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  taskId?: number;
}
