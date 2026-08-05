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
import { WorkflowVersionState } from 'src/custom-workflows/workflow-contract';
import { ProjectWorkflow } from './ProjectWorkflow';
import { ProjectWorkflowStatus } from './ProjectWorkflowStatus';
import { ProjectWorkflowTransition } from './ProjectWorkflowTransition';
import { User } from './User';

@Entity('project_workflow_versions')
@Index('UQ_project_workflow_version_number', ['workflow', 'version_number'], {
  unique: true,
})
@Index('IDX_project_workflow_version_state', ['workflow', 'state'])
export class ProjectWorkflowVersion {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => ProjectWorkflow, (workflow) => workflow.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workflow_id' })
  workflow: ProjectWorkflow;

  @Column({ type: 'int', unsigned: true }) version_number: number;

  @Column({ type: 'enum', enum: WorkflowVersionState })
  state: WorkflowVersionState;

  @Column({ type: 'varchar', length: 180, default: 'Project workflow' })
  name: string;

  @Column({ type: 'text', nullable: true }) description: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'published_by_id' })
  published_by: User | null;

  @Column({ type: 'datetime', nullable: true }) published_at: Date | null;

  @OneToMany(() => ProjectWorkflowStatus, (status) => status.version)
  statuses: ProjectWorkflowStatus[];

  @OneToMany(
    () => ProjectWorkflowTransition,
    (transition) => transition.version,
  )
  transitions: ProjectWorkflowTransition[];

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
