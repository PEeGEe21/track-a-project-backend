import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ResourceType } from 'src/utils/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ enum: ResourceType })
  @IsEnum(ResourceType)
  @IsOptional()
  type?: ResourceType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mime_type?: string;

  @ApiProperty()
  @IsString()
  projectId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  taskId?: string;

  @ApiPropertyOptional({ format: 'uri' })
  @IsOptional()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  file_size?: number;
}
