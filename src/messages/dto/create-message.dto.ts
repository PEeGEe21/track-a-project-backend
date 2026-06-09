import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateMessageAttachmentDto {
  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fileType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}

export class CreateMessageDto {
  @IsUUID()
  conversationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientMessageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CreateMessageAttachmentDto)
  attachments?: CreateMessageAttachmentDto[];
}
