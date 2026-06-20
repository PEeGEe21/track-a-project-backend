import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';

@Entity({ name: 'ingest_api_keys' })
@Index(['projectId', 'revoked_at'])
@Index(['organization_id', 'revoked_at'])
export class IngestApiKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'uuid', name: 'organization_id' })
  organization_id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Index({ unique: true })
  @Column({ name: 'key_hash', length: 255 })
  keyHash: string;

  @Column({ name: 'key_prefix', length: 32 })
  keyPrefix: string;

  @Column({ length: 255 })
  label: string;

  @Column({ type: 'datetime', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'datetime', nullable: true })
  last_used_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
