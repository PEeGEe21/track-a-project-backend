import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskRecurrence } from './TaskRecurrence';

@Entity('task_recurrence_exceptions')
@Index(['recurrence_id', 'scheduled_due_at'], { unique: true })
export class TaskRecurrenceException {
  @PrimaryGeneratedColumn() id: number;
  @Column() recurrence_id: number;
  @ManyToOne(() => TaskRecurrence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recurrence_id' })
  recurrence: TaskRecurrence;
  @Column({ type: 'datetime' }) scheduled_due_at: Date;
  @Column({ length: 20 }) action: 'skip' | 'reschedule';
  @Column({ type: 'datetime', nullable: true }) rescheduled_due_at: Date | null;
  @Column({ length: 240, nullable: true }) reason: string | null;
  @Column() created_by_id: number;
  @CreateDateColumn() created_at: Date;
}
