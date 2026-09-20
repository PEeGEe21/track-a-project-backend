import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('github_deliveries')
@Index(
  'UQ_github_delivery_provider',
  ['connection_id', 'provider_delivery_id'],
  { unique: true },
)
@Index('IDX_github_delivery_connection_received', [
  'connection_id',
  'received_at',
])
export class GithubDelivery {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'int' }) project_id: number;
  @Column({ type: 'uuid' }) connection_id: string;
  @Column({ type: 'varchar', length: 100 }) provider_delivery_id: string;
  @Column({ type: 'varchar', length: 60 }) event: string;
  @Column({ type: 'varchar', length: 60, nullable: true }) action:
    | string
    | null;
  @Column({ type: 'varchar', length: 30 }) state: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) failure_code:
    | string
    | null;
  @Column({ type: 'int', default: 0 }) artifact_count: number;
  @Column({ type: 'int', default: 0 }) link_count: number;
  @Column({ type: 'datetime', precision: 6 }) received_at: Date;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  processed_at: Date | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
