import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';
import { Project } from './Project';
import {
  AuditActorType,
  AuditOutcome,
  AuditSource,
  AuditSubjectType,
} from 'src/audit/audit-contract';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string; // IMPERSONATE_USER, SUBSCRIPTION_CHANGE, etc.

  // Transitional direct writers remain schema v1 until AT-03/AT-04 migrate them.
  // AuditWriterService always sets the current version explicitly.
  @Column({ type: 'int', unsigned: true, default: 1 })
  schema_version: number;

  @Column({ type: 'bigint', nullable: true })
  admin_id: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'admin_id' })
  admin: User;

  @Column({ type: 'bigint', nullable: true })
  target_user_id: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'target_user_id' })
  target_user: User;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'int', nullable: true })
  project_id: number | null;

  @ManyToOne(() => Project, { nullable: true })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  actor_type: AuditActorType | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  actor_id: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  actor_label: string | null;

  @Column({ type: 'bigint', nullable: true })
  responsible_user_id: number | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  subject_type: AuditSubjectType | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  subject_id: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subject_label: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  source: AuditSource | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  outcome: AuditOutcome | null;

  @Column({ type: 'json', nullable: true })
  before_changes: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  after_changes: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Column({ type: 'varchar', length: 80, nullable: true })
  request_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  correlation_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  causation_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  source_event_key: string | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  occurred_at: Date | null;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  retention_expires_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
