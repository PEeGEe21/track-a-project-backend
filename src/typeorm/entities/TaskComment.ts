import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Task } from './Task';
import { User } from './User';
import { TaskCommentReaction } from './TaskCommentReaction';
@Entity('task_comments')
export class TaskComment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() task_id: number;
  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'bigint' }) author_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'author_id' })
  author: User;
  @Column({ type: 'uuid', nullable: true }) parent_id: string | null;
  @Column({ type: 'uuid', nullable: true }) root_id: string | null;
  @ManyToOne(() => TaskComment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent: TaskComment | null;
  @Column({ type: 'text' }) content: string;
  @Column({ type: 'json', nullable: true }) mentions: number[] | null;
  @Column({ default: false }) is_resolved: boolean;
  @Column({ type: 'bigint', nullable: true }) resolved_by_id: number | null;
  @Column({ type: 'datetime', nullable: true }) resolved_at: Date | null;
  @Column({ type: 'datetime', nullable: true }) edited_at: Date | null;
  @Column({ type: 'datetime', nullable: true }) deleted_at: Date | null;
  @OneToMany(() => TaskCommentReaction, (r) => r.comment)
  reactions: TaskCommentReaction[];
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
