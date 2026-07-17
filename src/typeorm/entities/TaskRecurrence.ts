import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { Task } from './Task';
import { User } from './User';
import { TaskRecurrenceOccurrence } from './TaskRecurrenceOccurrence';

export enum RecurrenceFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  WEEKDAYS = 'weekdays',
}
export enum RecurrenceGenerationMode {
  ON_COMPLETION = 'on_completion',
  BEFORE_DUE = 'before_due',
}

@Entity('task_recurrences')
@Index(['organization_id', 'active', 'next_generation_at'])
export class TaskRecurrence {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ type: 'bigint' }) created_by_id: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;
  @Column() template_task_id: number;
  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_task_id' })
  template_task: Task;
  @Column({ type: 'enum', enum: RecurrenceFrequency })
  frequency: RecurrenceFrequency;
  @Column({ type: 'int', default: 1 }) interval: number;
  @Column({ type: 'json', nullable: true }) weekdays: number[] | null;
  @Column({ length: 64 }) timezone: string;
  @Column({ type: 'enum', enum: RecurrenceGenerationMode })
  generation_mode: RecurrenceGenerationMode;
  @Column({ type: 'int', default: 0 }) generate_before_days: number;
  @Column({ type: 'datetime' }) next_due_at: Date;
  @Column({ type: 'datetime', nullable: true }) next_generation_at: Date | null;
  @Column({ type: 'datetime', nullable: true }) end_at: Date | null;
  @Column({ default: true }) active: boolean;
  @Column({ type: 'datetime', nullable: true }) last_generated_at: Date | null;
  @OneToMany(
    () => TaskRecurrenceOccurrence,
    (occurrence) => occurrence.recurrence,
  )
  occurrences: TaskRecurrenceOccurrence[];
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
