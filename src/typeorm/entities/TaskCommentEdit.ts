import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskComment } from './TaskComment';
import { User } from './User';
@Entity('task_comment_edits')
export class TaskCommentEdit {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'uuid' }) comment_id: string;
  @ManyToOne(() => TaskComment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: TaskComment;
  @Column({ type: 'bigint' }) editor_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'editor_id' })
  editor: User;
  @Column({ type: 'text' }) previous_content: string;
  @CreateDateColumn() created_at: Date;
}
