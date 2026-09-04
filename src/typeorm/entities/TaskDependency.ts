import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('task_dependencies')
@Index(
  'UQ_task_dependency_edge',
  ['organization_id', 'task_id', 'depends_on_task_id'],
  { unique: true },
)
@Index('IDX_task_dependency_lookup', ['organization_id', 'task_id', 'active'])
export class TaskDependency {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column() task_id: number;
  @Column() depends_on_task_id: number;
  @Column({ length: 255 }) task_title_snapshot: string;
  @Column({ length: 255 }) depends_on_title_snapshot: string;
  @Column() created_by_user_id: number;
  @Column({ nullable: true }) removed_by_user_id: number | null;
  @Column({ length: 40, nullable: true }) removal_reason: string | null;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
