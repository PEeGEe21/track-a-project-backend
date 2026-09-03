import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('audit_purge_runs')
@Index('IDX_audit_purge_worker', ['state', 'created_at'])
export class AuditPurgeRun {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'bigint' }) requested_by_user_id: number;
  @Column({ type: 'varchar', length: 20, default: 'queued' }) state: 'queued' | 'running' | 'completed' | 'failed';
  @Column({ type: 'datetime', precision: 6 }) cutoff_at: Date;
  @Column({ type: 'varchar', length: 36, nullable: true }) cursor_id: string | null;
  @Column({ type: 'int', unsigned: true, default: 0 }) deleted_count: number;
  @Column({ type: 'varchar', length: 80, nullable: true }) failure_code: string | null;
  @Column({ type: 'datetime', precision: 6, nullable: true }) completed_at: Date | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
