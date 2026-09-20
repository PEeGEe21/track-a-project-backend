import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('github_link_diagnostics')
@Index('IDX_github_link_diagnostic_project', [
  'project_id',
  'resolved_at',
  'created_at',
])
@Index(
  'UQ_github_link_diagnostic_delivery_token',
  ['connection_id', 'delivery_id', 'artifact_provider_id', 'token'],
  { unique: true },
)
export class GithubLinkDiagnostic {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'int' }) project_id: number;
  @Column({ type: 'uuid' }) connection_id: string;
  @Column({ type: 'varchar', length: 100 }) delivery_id: string;
  @Column({ type: 'varchar', length: 160 }) artifact_provider_id: string;
  @Column({ type: 'varchar', length: 40 }) artifact_type: string;
  @Column({ type: 'varchar', length: 40 }) source: string;
  @Column({ type: 'varchar', length: 40 }) reason: string;
  @Column({ type: 'varchar', length: 40 }) token: string;
  @Column({ type: 'int', nullable: true }) referenced_task_id: number | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  resolved_at: Date | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
}
