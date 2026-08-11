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
import { User } from './User';

@Entity('intake_webhook_sources')
@Index('UQ_intake_webhook_public_key', ['public_key'], { unique: true })
@Index('IDX_intake_webhook_project_active', ['project_id', 'active'])
export class IntakeWebhookSource {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ length: 64 }) public_key: string;
  @Column({ length: 180 }) name: string;
  @Column({ type: 'text' }) secret_ciphertext: string;
  @Column({ type: 'text', nullable: true }) previous_secret_ciphertext:
    | string
    | null;
  @Column({ type: 'datetime', nullable: true })
  previous_secret_expires_at: Date | null;
  @Column({ type: 'json' }) mapping: Record<string, unknown>;
  @Column({ default: true }) active: boolean;
  @Column({ type: 'bigint' }) created_by_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
