import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkflowStep } from './WorkflowStep';
import { Project } from './Project';

@Entity('workflow_templates')
export class WorkflowTemplate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'int' }) source_project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_project_id' })
  source_project: Project;
  @Column({ type: 'int' }) created_by_id: number;
  @Column({ length: 180 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'uuid', nullable: true }) diagram_whiteboard_id:
    | string
    | null;
  @OneToMany(() => WorkflowStep, (step) => step.template, { cascade: true })
  steps: WorkflowStep[];
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
