import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ResourceType } from 'src/utils/types';

export class UploadFileDto {
  @IsString()
  title: string;

  @IsEnum(ResourceType)
  @IsOptional()
  type?: ResourceType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  projectId: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsOptional()
  url?: string;

  @IsOptional()
  file_size?: number;
}
