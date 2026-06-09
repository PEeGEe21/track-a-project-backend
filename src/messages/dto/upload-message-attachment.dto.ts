import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadMessageAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}
