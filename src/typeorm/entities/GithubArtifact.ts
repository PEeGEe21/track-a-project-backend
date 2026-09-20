import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('github_artifacts')
@Index(
  'UQ_github_artifact_identity',
  ['connection_id', 'artifact_type', 'provider_id'],
  { unique: true },
)
export class GithubArtifact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'int' }) project_id: number;
  @Column({ type: 'uuid' }) connection_id: string;
  @Column({ type: 'varchar', length: 30 }) artifact_type: string;
  @Column({ type: 'varchar', length: 160 }) provider_id: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) reference:
    | string
    | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) title:
    | string
    | null;
  @Column({ type: 'varchar', length: 60, nullable: true }) state: string | null;
  @Column({ type: 'varchar', length: 2048 }) url: string;
  @Column({ type: 'varchar', length: 160, nullable: true }) actor_label:
    | string
    | null;
  @Column({ type: 'json', nullable: true }) metadata: Record<
    string,
    unknown
  > | null;
  @Column({ type: 'varchar', length: 100 }) last_delivery_id: string;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  provider_updated_at: Date | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
