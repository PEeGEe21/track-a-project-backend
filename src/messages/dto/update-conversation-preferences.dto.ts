import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateConversationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}
