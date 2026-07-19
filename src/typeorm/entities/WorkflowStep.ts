import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkflowTemplate } from './WorkflowTemplate';

@Entity('workflow_steps')
export class WorkflowStep {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) template_id: string;
  @ManyToOne(() => WorkflowTemplate, (template) => template.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template: WorkflowTemplate;
  @Column({ type: 'int' }) position: number;
  @Column({ type: 'int' }) source_task_id: number;
  @Column({ length: 255 }) title: string;
  @Column({ type: 'longtext', nullable: true }) description: string | null;
  @Column({ length: 180, nullable: true }) source_status_title: string | null;
  @Column({ type: 'int', nullable: true }) source_assignee_id: number | null;
  @Column({ type: 'simple-json', nullable: true })
  source_assignee_ids: number[] | null;
  @Column({ type: 'int', nullable: true }) due_offset_days: number | null;
}
