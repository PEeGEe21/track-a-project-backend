import { IsOptional, IsUUID } from 'class-validator';

export class MarkConversationReadDto {
  @IsOptional()
  @IsUUID()
  lastReadMessageId?: string;
}
