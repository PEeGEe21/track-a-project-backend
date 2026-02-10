// ConversationParticipant.ts - Join table with metadata
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
import { Conversation } from './Conversation';
import { Organization } from './Organization';

@Entity({ name: 'conversation_participants' })
@Index(['conversationId', 'userId'], { unique: true })
@Index(['userId', 'isActive'])
export class ConversationParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => User, (user) => user.conversationParticipants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'bigint' })
  userId: number;

  @Column({
    type: 'enum',
    enum: ['admin', 'member'],
    default: 'member',
  })
  role: 'admin' | 'member'; // For group permissions

  @Column({ default: false })
  isMuted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastReadAt: Date; // Track read status per participant

  @Column({ default: true })
  isActive: boolean; // false if user left the group

  @Column({ type: 'timestamp', nullable: true })
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt: Date;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
