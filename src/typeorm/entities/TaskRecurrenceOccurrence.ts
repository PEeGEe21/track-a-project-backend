import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from './Task';
import { TaskRecurrence } from './TaskRecurrence';

@Entity('task_recurrence_occurrences')
@Index(['recurrence_id', 'scheduled_due_at'], { unique: true })
export class TaskRecurrenceOccurrence {
  @PrimaryGeneratedColumn() id: number;
  @Column() recurrence_id: number;
  @ManyToOne(() => TaskRecurrence, (recurrence) => recurrence.occurrences, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recurrence_id' })
  recurrence: TaskRecurrence;
  @Column() task_id: number;
  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;
  @Column({ type: 'datetime' }) scheduled_due_at: Date;
  @Column({ type: 'int', nullable: true }) previous_task_id: number | null;
  @CreateDateColumn() created_at: Date;
}
