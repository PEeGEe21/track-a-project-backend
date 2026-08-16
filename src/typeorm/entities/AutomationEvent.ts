import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { AutomationRun } from './AutomationRun';

export const AUTOMATION_EVENT_ACTOR_TYPES = [
  'human',
  'automation',
  'system',
  'integration',
] as const;
export type AutomationEventActorType =
  (typeof AUTOMATION_EVENT_ACTOR_TYPES)[number];

@Entity('automation_events')
@Index('IDX_automation_events_project_available', [
  'project_id',
  'available_at',
])
@Index('IDX_automation_events_org_correlation', [
  'organization_id',
  'correlation_id',
])
@Index('IDX_automation_events_subject', ['subject_type', 'subject_id'])
@Index(
  'UQ_automation_event_dedupe',
  ['organization_id', 'event_type', 'dedupe_key'],
  { unique: true },
)
export class AutomationEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ type: 'varchar', length: 100 }) event_type: string;
  @Column({ type: 'varchar', length: 80 }) subject_type: string;
  @Column({ type: 'varchar', length: 80 }) subject_id: string;
  @Column({ type: 'varchar', length: 255, nullable: true })
  dedupe_key: string | null;
  @Column({ type: 'json', nullable: true })
  before_snapshot: Record<string, unknown> | null;
  @Column({ type: 'json', nullable: true })
  after_snapshot: Record<string, unknown> | null;
  @Column({ type: 'enum', enum: AUTOMATION_EVENT_ACTOR_TYPES })
  actor_type: AutomationEventActorType;
  @Column({ type: 'varchar', length: 80, nullable: true })
  actor_id: string | null;
  @Column({ type: 'uuid' }) correlation_id: string;
  @Column({ type: 'uuid', nullable: true }) causation_event_id: string | null;
  @ManyToOne(() => AutomationEvent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'causation_event_id' })
  causation_event: AutomationEvent | null;
  @Column({ type: 'json', nullable: true })
  ancestor_rule_ids: string[] | null;
  @Column({ type: 'int', unsigned: true, default: 0 }) chain_depth: number;
  @Column({ type: 'int', unsigned: true, default: 0 }) action_count: number;
  @Column({ type: 'datetime', precision: 6 }) occurred_at: Date;
  @Column({ type: 'datetime', precision: 6 }) available_at: Date;
  @OneToMany(() => AutomationRun, (run) => run.event)
  runs: AutomationRun[];
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
}
