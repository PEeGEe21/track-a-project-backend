import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectWorkflowTransition } from './ProjectWorkflowTransition';
import { ProjectWorkflowVersion } from './ProjectWorkflowVersion';
import { Status } from './Status';

@Entity('project_workflow_statuses')
@Index('UQ_project_workflow_status_key', ['version', 'key'], { unique: true })
@Index('UQ_project_workflow_status_link', ['version', 'status'], {
  unique: true,
})
export class ProjectWorkflowStatus {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => ProjectWorkflowVersion, (version) => version.statuses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'version_id' })
  version: ProjectWorkflowVersion;

  @ManyToOne(() => Status, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'status_id' })
  status: Status;

  @Column({ type: 'varchar', length: 100 }) key: string;
  @Column({ type: 'int', unsigned: true, default: 0 }) position: number;
  @Column({ type: 'boolean', default: false }) is_initial: boolean;
  @Column({ type: 'boolean', default: false }) is_terminal: boolean;

  @OneToMany(() => ProjectWorkflowTransition, (transition) => transition.source)
  outgoing: ProjectWorkflowTransition[];

  @OneToMany(
    () => ProjectWorkflowTransition,
    (transition) => transition.destination,
  )
  incoming: ProjectWorkflowTransition[];
}
