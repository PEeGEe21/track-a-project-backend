// dto/message-response.dto.ts
import { Expose, Type } from 'class-transformer';
import { UserChatDto } from './user-chat.dto';

export class MessageResponseDto {
  @Expose()
  id: string;

  @Expose()
  content: string;

  @Expose()
  messageType: string;

  @Expose()
  fileType: string | null;

  @Expose()
  fileUrl: string | null;

  @Expose()
  created_at: Date;

  @Expose()
  @Type(() => UserChatDto)
  sender: UserChatDto;

  @Expose()
  isMine: boolean; // ← for frontend: "me" or not

  @Expose()
  time: string; // ← formatted time

  @Expose()
  status: 'sent' | 'delivered' | 'read'; // ← you can compute later
}