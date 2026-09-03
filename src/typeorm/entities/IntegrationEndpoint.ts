import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('integration_endpoints')
@Index('IDX_integration_endpoint_org_active', ['organization_id', 'active'])
export class IntegrationEndpoint {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'int', nullable: true }) project_id: number | null;
  @Column({ type: 'varchar', length: 160 }) name: string;
  @Column({ type: 'varchar', length: 2048 }) url: string;
  @Column({ type: 'json' }) actions: string[];
  @Column({ type: 'text', select: false }) secret_ciphertext: string;
  @Column({ type: 'text', nullable: true, select: false })
  previous_secret_ciphertext: string | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  previous_secret_expires_at: Date | null;
  @Column({ default: true }) active: boolean;
  @Column({ type: 'bigint' }) created_by_user_id: number;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
