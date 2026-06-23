import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from './Project';
import { ClosedTaskDedupeBehavior } from 'src/ingestion/constants/closed-task-dedupe-behavior';

@Entity({ name: 'project_ingestion_settings' })
export class ProjectIngestionSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id', unique: true })
  projectId: number;

  @OneToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({
    type: 'enum',
    enum: ['reopen', 'create_new', 'reopen_if_recent'],
    default: 'reopen',
    name: 'closed_task_dedupe_behavior',
  })
  closedTaskDedupeBehavior: ClosedTaskDedupeBehavior;

  @Column({
    type: 'int',
    default: 7,
    name: 'reopen_if_recent_window_days',
  })
  reopenIfRecentWindowDays: number;
}
