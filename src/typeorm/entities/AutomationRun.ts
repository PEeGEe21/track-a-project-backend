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
import { AutomationRule } from './AutomationRule';
import { AutomationRuleVersion } from './AutomationRuleVersion';
import { AutomationEvent } from './AutomationEvent';
import { AutomationActionAttempt } from './AutomationActionAttempt';

export const AUTOMATION_RUN_STATES = [
  'queued',
  'evaluating',
  'running',
  'succeeded',
  'failed',
  'skipped',
  'cancelled',
] as const;
export type AutomationRunState = (typeof AUTOMATION_RUN_STATES)[number];

@Entity('automation_runs')
@Index(
  'UQ_automation_run_execution',
  ['rule_id', 'rule_version_id', 'event_id'],
  { unique: true },
)
@Index('IDX_automation_runs_project_created', ['project_id', 'created_at'])
@Index('IDX_automation_runs_rule_state', ['rule_id', 'state'])
export class AutomationRun {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ type: 'uuid' }) rule_id: string;
  @ManyToOne(() => AutomationRule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: AutomationRule;
  @Column({ type: 'uuid' }) rule_version_id: string;
  @ManyToOne(() => AutomationRuleVersion, (version) => version.runs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rule_version_id' })
  rule_version: AutomationRuleVersion;
  @Column({ type: 'uuid' }) event_id: string;
  @ManyToOne(() => AutomationEvent, (event) => event.runs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: AutomationEvent;
  @Column({ type: 'enum', enum: AUTOMATION_RUN_STATES, default: 'queued' })
  state: AutomationRunState;
  @Column({ type: 'json', nullable: true })
  condition_trace: Record<string, unknown>[] | null;
  @Column({ nullable: true }) matched: boolean | null;
  @Column({ type: 'int', unsigned: true, default: 0 }) attempt_count: number;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  started_at: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  finished_at: Date | null;
  @Column({ type: 'varchar', length: 100, nullable: true })
  failure_code: string | null;
  @OneToMany(() => AutomationActionAttempt, (attempt) => attempt.run)
  action_attempts: AutomationActionAttempt[];
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
