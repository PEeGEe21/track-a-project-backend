import { Expose, Type } from 'class-transformer';
import { UserChatDto } from './user-chat.dto';

export class MessageAttachmentResponseDto {
  @Expose()
  fileUrl: string;

  @Expose()
  fileType: string | null;

  @Expose()
  fileName: string | null;
}

export class MessageReactionResponseDto {
  @Expose()
  id: string;

  @Expose()
  emoji: string;

  @Expose()
  userId: number;

  @Expose()
  createdAt: Date;
}

export class MessageReadByResponseDto {
  @Expose()
  userId: number;

  @Expose()
  readAt: Date;
}

export class MessageReplyPreviewDto {
  @Expose()
  id: string;

  @Expose()
  content: string | null;

  @Expose()
  messageType: string;

  @Expose()
  createdAt: Date;

  @Expose()
  @Type(() => UserChatDto)
  sender: UserChatDto;
}

export class MessageResponseDto {
  @Expose()
  id: string;

  @Expose()
  clientMessageId: string | null;

  @Expose()
  conversationId: string;

  @Expose()
  content: string | null;

  @Expose()
  senderId: number;

  @Expose()
  messageType: string;

  @Expose()
  fileType: string | null;

  @Expose()
  fileUrl: string | null;

  @Expose()
  @Type(() => MessageAttachmentResponseDto)
  attachments: MessageAttachmentResponseDto[];

  @Expose()
  replyToId: string | null;

  @Expose()
  @Type(() => MessageReplyPreviewDto)
  replyTo: MessageReplyPreviewDto | null;

  @Expose()
  created_at: Date;

  @Expose()
  createdAt?: string;

  @Expose()
  updatedAt?: string;

  @Expose()
  @Type(() => UserChatDto)
  sender: UserChatDto;

  @Expose()
  isMine: boolean;

  @Expose()
  time: string;

  @Expose()
  deliveryStatus: 'sent' | 'delivered' | 'read';

  @Expose()
  status: 'sent' | 'delivered' | 'read';

  @Expose()
  @Type(() => MessageReactionResponseDto)
  reactions: MessageReactionResponseDto[];

  @Expose()
  @Type(() => MessageReadByResponseDto)
  readBy: MessageReadByResponseDto[];

  @Expose()
  isStarred: boolean;
}
