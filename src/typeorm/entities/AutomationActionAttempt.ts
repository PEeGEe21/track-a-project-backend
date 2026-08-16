import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AutomationRun } from './AutomationRun';

export const AUTOMATION_ACTION_ATTEMPT_STATES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped',
] as const;
export type AutomationActionAttemptState =
  (typeof AUTOMATION_ACTION_ATTEMPT_STATES)[number];

@Entity('automation_action_attempts')
@Index(
  'UQ_automation_action_attempt_number',
  ['run_id', 'action_key', 'attempt_number'],
  { unique: true },
)
@Index('UQ_automation_action_idempotency', ['idempotency_key'], {
  unique: true,
})
@Index('IDX_automation_action_attempts_run_state', ['run_id', 'state'])
export class AutomationActionAttempt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) run_id: string;
  @ManyToOne(() => AutomationRun, (run) => run.action_attempts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'run_id' })
  run: AutomationRun;
  @Column({ type: 'varchar', length: 80 }) action_key: string;
  @Column({ type: 'varchar', length: 255 }) idempotency_key: string;
  @Column({ type: 'enum', enum: AUTOMATION_ACTION_ATTEMPT_STATES })
  state: AutomationActionAttemptState;
  @Column({ type: 'int', unsigned: true }) attempt_number: number;
  @Column({ type: 'json', nullable: true })
  input_snapshot: Record<string, unknown> | null;
  @Column({ type: 'json', nullable: true })
  result_snapshot: Record<string, unknown> | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  started_at: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  finished_at: Date | null;
  @Column({ type: 'varchar', length: 100, nullable: true })
  failure_code: string | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
}
