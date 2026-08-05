import {
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
import { ProjectWorkflowVersion } from './ProjectWorkflowVersion';

@Entity('project_workflows')
@Index('UQ_project_workflows_project', ['project'], { unique: true })
export class ProjectWorkflow {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany(() => ProjectWorkflowVersion, (version) => version.workflow)
  versions: ProjectWorkflowVersion[];

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
