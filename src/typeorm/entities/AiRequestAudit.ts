import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_request_audits')
@Index(['organization_id', 'created_at'])
@Index(['organization_id', 'user_id', 'created_at'])
export class AiRequestAudit {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', unique: true }) correlation_id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'bigint' }) user_id: number;
  @Column({ length: 80 }) feature_id: string;
  @Column({ length: 80 }) template_id: string;
  @Column({ type: 'int' }) template_version: number;
  @Column({ length: 40 }) provider: string;
  @Column({ length: 100 }) model: string;
  @Column({ type: 'int', default: 0 }) input_size: number;
  @Column({ type: 'int', default: 0 }) output_size: number;
  @Column({ type: 'int', default: 0 }) latency_ms: number;
  @Column({ length: 20 }) status: 'started' | 'succeeded' | 'failed';
  @Column({ length: 100, nullable: true }) error_code: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 6, nullable: true }) estimated_cost: number | null;
  @CreateDateColumn() created_at: Date;
}
