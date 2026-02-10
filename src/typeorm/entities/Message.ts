// Message.ts
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
import { Conversation } from './Conversation';
import { MessageReaction } from './MessageReaction';
import { MessageReadReceipt } from './MessageReadReceipt';
import { Organization } from './Organization';

@Entity({ name: 'messages' })
@Index(['conversationId', 'created_at'])
@Index(['senderId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => User, (user) => user.sentMessages, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'bigint' })
  senderId: number;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fileType: string;

  @Column({
    type: 'enum',
    enum: ['text', 'file', 'image', 'video', 'system'],
    default: 'text',
  })
  messageType: string; // 'system' for "User joined", "User left", etc.

  @Column({ default: false })
  isEdited: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  // For reply/thread support
  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'reply_to_id' })
  replyTo: Message;

  @Column({ type: 'uuid', nullable: true })
  replyToId: string;

  @OneToMany(() => MessageReaction, (reaction) => reaction.message)
  reactions: MessageReaction[];

  @OneToMany(() => MessageReadReceipt, (receipt) => receipt.message)
  readReceipts: MessageReadReceipt[];

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
