// dto/user-chat.dto.ts
import { Expose } from 'class-transformer';

export class UserChatDto {
  @Expose()
  id: string;

  @Expose()
  first_name: string;

  @Expose()
  last_name: string;

  @Expose()
  username: string | null;

  @Expose()
  avatar: string;

  @Expose()
  get fullName(): string {
    return `${this.first_name} ${this.last_name}`.trim();
  }
}