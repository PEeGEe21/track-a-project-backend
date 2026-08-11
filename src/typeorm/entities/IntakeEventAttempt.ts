import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IntakeEvent } from './IntakeEvent';

export const INTAKE_ATTEMPT_TRIGGERS = [
  'initial',
  'automatic_retry',
  'manual_retry',
  'reprocess',
] as const;
export type IntakeAttemptTrigger = (typeof INTAKE_ATTEMPT_TRIGGERS)[number];

export const INTAKE_ATTEMPT_STATES = [
  'processing',
  'succeeded',
  'failed',
] as const;
export type IntakeAttemptState = (typeof INTAKE_ATTEMPT_STATES)[number];

@Entity('intake_event_attempts')
@Index('UQ_intake_event_attempt_number', ['event_id', 'attempt_number'], {
  unique: true,
})
export class IntakeEventAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  event_id: string;

  @ManyToOne(() => IntakeEvent, (event) => event.attempts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: IntakeEvent;

  @Column({ type: 'int', unsigned: true })
  attempt_number: number;

  @Column({ type: 'enum', enum: INTAKE_ATTEMPT_TRIGGERS })
  trigger: IntakeAttemptTrigger;

  @Column({ type: 'enum', enum: INTAKE_ATTEMPT_STATES })
  state: IntakeAttemptState;

  @Column({ type: 'json', nullable: true })
  diagnostic_snapshot: Record<string, unknown> | null;

  @Column({ type: 'datetime', precision: 6 })
  started_at: Date;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  completed_at: Date | null;
}
