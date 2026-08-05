import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TransitionRequirements } from 'src/custom-workflows/workflow-contract';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { ProjectWorkflowStatus } from './ProjectWorkflowStatus';
import { ProjectWorkflowVersion } from './ProjectWorkflowVersion';

@Entity('project_workflow_transitions')
@Index('UQ_project_workflow_transition_key', ['version', 'key'], {
  unique: true,
})
@Index(
  'UQ_project_workflow_transition_edge',
  ['version', 'source', 'destination'],
  { unique: true },
)
export class ProjectWorkflowTransition {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => ProjectWorkflowVersion, (version) => version.transitions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'version_id' })
  version: ProjectWorkflowVersion;

  @ManyToOne(() => ProjectWorkflowStatus, (status) => status.outgoing, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'source_status_id' })
  source: ProjectWorkflowStatus;

  @ManyToOne(() => ProjectWorkflowStatus, (status) => status.incoming, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'destination_status_id' })
  destination: ProjectWorkflowStatus;

  @Column({ type: 'varchar', length: 180 }) key: string;
  @Column({ type: 'varchar', length: 180, nullable: true }) label:
    | string
    | null;
  @Column({ type: 'json' }) allowed_roles: ProjectRole[];
  @Column({ type: 'json', nullable: true })
  requirements: TransitionRequirements | null;
}
