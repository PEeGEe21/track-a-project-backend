// src/documents/dto/move-document.dto.ts
import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoveDocumentDto {
  @ApiPropertyOptional({ description: 'Folder ID to move document to (null for root)' })
  @IsOptional()
  @IsUUID()
  folderId?: string | null;
}