// MessageReaction.ts
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

@Entity({ name: 'message_reactions' })
export class MessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message, (message) => message.reactions, {
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

  @Column({ type: 'varchar', length: 10 })
  emoji: string;

  @CreateDateColumn()
  created_at: Date;
}
