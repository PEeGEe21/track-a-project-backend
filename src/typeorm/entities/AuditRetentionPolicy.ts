import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('audit_retention_policies')
export class AuditRetentionPolicy {
  @PrimaryColumn({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'int', unsigned: true }) retention_days: number;
  @Column({ type: 'bigint' }) updated_by_user_id: number;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
