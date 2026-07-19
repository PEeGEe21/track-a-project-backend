import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TaskComment } from './TaskComment';
import { User } from './User';
@Entity('task_comment_reactions')
@Unique(['comment_id', 'user_id', 'emoji'])
export class TaskCommentReaction {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'uuid' }) comment_id: string;
  @ManyToOne(() => TaskComment, (c) => c.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: TaskComment;
  @Column({ type: 'bigint' }) user_id: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
  @Column({ length: 32 }) emoji: string;
  @CreateDateColumn() created_at: Date;
}
