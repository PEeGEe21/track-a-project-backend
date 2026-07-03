// src/documents/dto/create-document.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsUUID,
  IsISO8601,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDocumentDto {
  @ApiProperty({ example: 'My Document Title' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: '<h1>Hello World</h1>' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: 'Hello World' })
  @IsOptional()
  @IsString()
  plainText?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiPropertyOptional({ description: 'Folder ID to place document in' })
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ApiPropertyOptional({
    description: 'Last known updated timestamp used for conflict detection',
  })
  @IsOptional()
  @IsISO8601()
  lastKnownUpdatedAt?: string;

}
