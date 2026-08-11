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
import { IntakeEvent } from './IntakeEvent';
import { Organization } from './Organization';
import { Project } from './Project';
import { User } from './User';

export const INTAKE_AI_SUGGESTION_STATES = [
  'pending',
  'applied',
  'dismissed',
  'stale',
] as const;
export type IntakeAiSuggestionState =
  (typeof INTAKE_AI_SUGGESTION_STATES)[number];

export type IntakeAiProposedChanges = {
  title?: string;
  category?: string;
  priority?: number;
  duplicateTaskId?: number;
  assigneeId?: number;
  destinationProjectId?: number;
};

@Entity('intake_ai_suggestions')
@Index('IDX_intake_ai_suggestions_event_state', ['event_id', 'state'])
@Index('IDX_intake_ai_suggestions_project_created', [
  'project_id',
  'created_at',
])
export class IntakeAiSuggestion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' }) project: Project;
  @Column({ type: 'uuid' }) event_id: string;
  @ManyToOne(() => IntakeEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' }) event: IntakeEvent;
  @Column({ type: 'enum', enum: INTAKE_AI_SUGGESTION_STATES })
  state: IntakeAiSuggestionState;
  @Column({ length: 64 }) payload_fingerprint: string;
  @Column({ type: 'json' }) proposed_changes: IntakeAiProposedChanges;
  @Column({ type: 'json' }) reasons: Record<string, string>;
  @Column({ type: 'json' }) confidence: Record<string, number>;
  @Column({ type: 'uuid' }) correlation_id: string;
  @Column({ length: 80 }) template_id: string;
  @Column({ type: 'int', unsigned: true }) template_version: number;
  @Column({ type: 'bigint' }) created_by_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' }) created_by: User;
  @Column({ type: 'bigint', nullable: true }) reviewed_by_id: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' }) reviewed_by: User | null;
  @Column({ type: 'datetime', nullable: true }) reviewed_at: Date | null;
  @Column({ length: 500, nullable: true }) review_note: string | null;
  @Column({ type: 'int', unsigned: true, default: 1 }) contract_version: number;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
