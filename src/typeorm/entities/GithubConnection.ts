import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('github_connections')
@Index(
  'UQ_github_connection_project_repo',
  ['project_id', 'repository_full_name'],
  { unique: true },
)
@Index('UQ_github_connection_webhook_key', ['webhook_key'], { unique: true })
@Index(
  'UQ_github_connection_provider_repo',
  ['project_id', 'provider_repository_id'],
  { unique: true },
)
export class GithubConnection {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'int' }) project_id: number;
  @Column({ type: 'varchar', length: 200 }) repository_full_name: string;
  @Column({ type: 'varchar', length: 40, nullable: true })
  provider_repository_id: string | null;
  @Column({ type: 'varchar', length: 64 }) webhook_key: string;
  @Column({ type: 'text', select: false }) secret_ciphertext: string;
  @Column({ type: 'text', nullable: true, select: false })
  previous_secret_ciphertext: string | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  previous_secret_expires_at: Date | null;
  @Column({ default: true }) active: boolean;
  @Column({ type: 'bigint' }) created_by_user_id: number;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  last_delivery_at: Date | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) last_delivery_state:
    | string
    | null;
  @Column({ type: 'varchar', length: 30, default: 'pending' })
  health_state: string;
  @Column({ type: 'int', default: 0 }) consecutive_failures: number;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  health_alerted_at: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  rotation_alerted_at: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  rotation_confirmed_at: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  repository_renamed_at: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  archived_at: Date | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
