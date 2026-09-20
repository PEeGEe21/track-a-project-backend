import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('github_task_links')
@Index('UQ_github_task_artifact', ['artifact_id', 'task_id'], { unique: true })
@Index('IDX_github_task_links_task', ['task_id', 'updated_at'])
export class GithubTaskLink {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'int' }) project_id: number;
  @Column({ type: 'uuid' }) artifact_id: string;
  @Column({ type: 'int' }) task_id: number;
  @Column({ type: 'varchar', length: 20, default: 'active' }) state: string;
  @Column({ type: 'varchar', length: 40, default: 'legacy' }) source: string;
  @Column({ type: 'uuid', nullable: true }) source_artifact_id: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) source_value:
    | string
    | null;
  @Column({ type: 'bigint', nullable: true }) created_by_user_id: number | null;
  @Column({ type: 'boolean', default: false }) manually_overridden: boolean;
  @Column({ type: 'varchar', length: 100 }) first_delivery_id: string;
  @Column({ type: 'varchar', length: 100 }) last_delivery_id: string;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
