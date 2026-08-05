import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Milestone } from './Milestone';
import { Task } from './Task';

@Entity('milestone_tasks')
@Unique('UQ_milestone_task', ['milestone_id', 'task_id'])
export class MilestoneTask {
  @PrimaryGeneratedColumn() id: number;

  @Column({ type: 'uuid' }) milestone_id: string;
  @ManyToOne(() => Milestone, (milestone) => milestone.task_links, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'milestone_id' })
  milestone: Milestone;

  @Column() task_id: number;
  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ default: true }) counts_toward_progress: boolean;
  @CreateDateColumn() created_at: Date;
}
