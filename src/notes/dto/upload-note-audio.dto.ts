import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadNoteAudioDto {
  @IsOptional() durationSeconds?: string | number;
  @IsOptional() @IsString() transcript?: string;
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  recordingConsent: boolean;
  @IsString() @MaxLength(32) noticeVersion: string;
}
