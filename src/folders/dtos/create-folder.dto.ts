// src/documents/dto/create-folder.dto.ts
import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ example: 'My Projects' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'All my project documents' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: '📁' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Parent folder ID for nested folders' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}