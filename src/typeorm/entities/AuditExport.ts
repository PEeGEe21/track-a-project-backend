import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum AuditExportState { QUEUED = 'queued', RUNNING = 'running', COMPLETED = 'completed', FAILED = 'failed', CANCELLED = 'cancelled', EXPIRED = 'expired' }

@Entity('audit_exports')
@Index('IDX_audit_export_worker', ['state', 'created_at'])
@Index('IDX_audit_export_expiry', ['expires_at'])
export class AuditExport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'bigint' }) requested_by_user_id: number;
  @Column({ type: 'varchar', length: 10 }) format: 'csv' | 'jsonl';
  @Column({ type: 'varchar', length: 20, default: AuditExportState.QUEUED }) state: AuditExportState;
  @Column({ type: 'json' }) filters: Record<string, unknown>;
  @Column({ type: 'datetime', precision: 6 }) watermark_at: Date;
  @Column({ type: 'longtext', nullable: true, select: false }) artifact: string | null;
  @Column({ type: 'int', unsigned: true, default: 0 }) row_count: number;
  @Column({ type: 'varchar', length: 80, nullable: true }) failure_code: string | null;
  @Column({ type: 'datetime', precision: 6, nullable: true }) completed_at: Date | null;
  @Column({ type: 'datetime', precision: 6 }) expires_at: Date;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
