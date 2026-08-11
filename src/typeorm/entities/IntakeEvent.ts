import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { Task } from './Task';
import { IntakeEventAttempt } from './IntakeEventAttempt';

export const INTAKE_CHANNELS = [
  'api',
  'sdk',
  'csv',
  'excel',
  'webhook',
  'email',
  'form',
] as const;
export type IntakeChannel = (typeof INTAKE_CHANNELS)[number];

export const INTAKE_EVENT_STATES = [
  'received',
  'validated',
  'accepted',
  'rejected',
  'quarantined',
  'failed',
] as const;
export type IntakeEventState = (typeof INTAKE_EVENT_STATES)[number];

@Entity('intake_events')
@Index(
  'UQ_intake_event_idempotency',
  ['organization_id', 'channel', 'source_key', 'idempotency_key'],
  { unique: true },
)
@Index('IDX_intake_events_project_created', ['project_id', 'created_at'])
@Index('IDX_intake_events_project_state', ['project_id', 'state'])
export class IntakeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column()
  project_id: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ nullable: true })
  task_id: number | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task: Task | null;

  @Column({ type: 'enum', enum: INTAKE_CHANNELS })
  channel: IntakeChannel;

  @Column({ length: 180 })
  source_key: string;

  @Column({ length: 255 })
  idempotency_key: string;

  @Column({ type: 'enum', enum: INTAKE_EVENT_STATES, default: 'received' })
  state: IntakeEventState;

  @Column({ type: 'json' })
  normalized_payload: Record<string, unknown>;

  @Column({ type: 'json', nullable: true })
  validation_snapshot: Record<string, unknown> | null;

  @Column({ length: 255, nullable: true })
  task_dedupe_key: string | null;

  @Column({ length: 80, nullable: true })
  failure_code: string | null;

  @Column({ type: 'text', nullable: true })
  failure_message: string | null;

  @Column({ default: false })
  retryable: boolean;

  @Column({ type: 'datetime' })
  received_at: Date;

  @Column({ type: 'datetime', nullable: true })
  processed_at: Date | null;

  @OneToMany(() => IntakeEventAttempt, (attempt) => attempt.event)
  attempts: IntakeEventAttempt[];

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at: Date;
}
