import { User } from 'src/typeorm/entities/User';

export class CreateNotificationDto {
  recipient: User;
  sender?: User | null;
  title: string;
  message?: string;
  type: string;
  metadata?: Record<string, any>;
}
