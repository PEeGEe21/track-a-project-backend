// MessageReadReceipt.ts - Track who read each message (important for groups)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './User';
import { Message } from './Message';

@Entity({ name: 'message_read_receipts' })
export class MessageReadReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message, (message) => message.readReceipts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Column({ type: 'uuid' })
  messageId: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'bigint' })
  userId: number;

  @Column({ type: 'timestamp' })
  readAt: Date;

  @CreateDateColumn()
  created_at: Date;
}
