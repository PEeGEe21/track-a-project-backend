import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { ProjectWorkflowVersion } from './ProjectWorkflowVersion';
import { Task } from './Task';
import { User } from './User';

@Entity('task_transition_history')
@Index('IDX_task_transition_history_task', ['task_id', 'created_at'])
@Index('IDX_task_transition_history_project', ['project_id', 'created_at'])
export class TaskTransitionHistory {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'int' }) project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'int' }) task_id: number;
  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => ProjectWorkflowVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflow_version_id' })
  workflow_version: ProjectWorkflowVersion;

  @Column({ type: 'varchar', length: 180 }) transition_key: string;
  @Column({ type: 'int' }) source_status_id: number;
  @Column({ type: 'varchar', length: 180 }) source_status_title: string;
  @Column({ type: 'int' }) destination_status_id: number;
  @Column({ type: 'varchar', length: 180 }) destination_status_title: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor: User | null;

  @Column({ type: 'json', nullable: true })
  validated_fields: Record<string, unknown> | null;

  @CreateDateColumn() created_at: Date;
}
