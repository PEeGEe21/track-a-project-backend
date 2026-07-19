import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './Project';

export enum WorkConversionSource {
  WHITEBOARD_OBJECT = 'whiteboard_object',
  TASK_SELECTION = 'task_selection',
  WORKFLOW_STEP = 'workflow_step',
}
export enum WorkConversionTarget {
  TASK = 'task',
  NOTE = 'note',
  WORKFLOW_TEMPLATE = 'workflow_template',
}

@Entity('work_conversions')
@Index(['organization_id', 'source_type', 'source_key'])
export class WorkConversion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'int' }) source_project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_project_id' })
  source_project: Project;
  @Column({ type: 'int', nullable: true }) destination_project_id:
    | number
    | null;
  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'destination_project_id' })
  destination_project: Project | null;
  @Column({ type: 'enum', enum: WorkConversionSource })
  source_type: WorkConversionSource;
  @Column({ length: 255 }) source_key: string;
  @Column({ type: 'enum', enum: WorkConversionTarget })
  target_type: WorkConversionTarget;
  @Column({ length: 64 }) target_id: string;
  @Column({ type: 'uuid' }) batch_id: string;
  @Column({ type: 'int' }) created_by_id: number;
  @Column({ type: 'json', nullable: true }) metadata: Record<
    string,
    unknown
  > | null;
  @CreateDateColumn() created_at: Date;
}
