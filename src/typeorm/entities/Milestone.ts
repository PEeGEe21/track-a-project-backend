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
import { User } from './User';
import { MilestoneTask } from './MilestoneTask';

export enum MilestoneStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum MilestoneHealth {
  ON_TRACK = 'on_track',
  AT_RISK = 'at_risk',
  OFF_TRACK = 'off_track',
}

@Entity('milestones')
@Index('IDX_milestones_project_status_target', [
  'project_id',
  'status',
  'target_date',
])
export class Milestone {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar', length: 180 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'text', nullable: true }) completion_criteria: string | null;
  @Column({ type: 'date', nullable: true }) target_date: string | null;
  @Column({ type: 'enum', enum: MilestoneStatus, default: MilestoneStatus.PLANNED })
  status: MilestoneStatus;
  @Column({ type: 'enum', enum: MilestoneHealth, default: MilestoneHealth.ON_TRACK })
  health: MilestoneHealth;

  @Column({ type: 'bigint', nullable: true }) owner_id: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  @Column({ type: 'bigint' }) created_by_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;

  @Column({ type: 'datetime', nullable: true }) achieved_at: Date | null;
  @Column({ type: 'text', nullable: true }) completion_reason: string | null;
  @Column({ type: 'datetime', nullable: true }) archived_at: Date | null;

  @OneToMany(() => MilestoneTask, (link) => link.milestone)
  task_links: MilestoneTask[];

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
