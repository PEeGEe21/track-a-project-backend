import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from './User';
import { Message } from './Message';
import { ConversationParticipant } from './ConversationParticipant';

@Entity({ name: 'conversations' })
@Index(['type'])
@Index(['lastMessageAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')   
  id: string;

  @Column({ type: 'enum', enum: ['direct', 'group'], default: 'direct' })
  type: 'direct' | 'group';

  @Column({ nullable: true })
  name: string; // Only for group chats

  @Column({ nullable: true })
  avatar: string; // Group chat avatar

  @Column({ nullable: true })
  description: string; // Group chat description

  @ManyToOne(() => User, { nullable: true }) // Group creator
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ type: 'bigint', nullable: true })
  created_by: number;

  @OneToMany(
    () => ConversationParticipant,
    (participant) => participant.conversation,
    {
      cascade: true,
    },
  )
  participants: ConversationParticipant[];

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
