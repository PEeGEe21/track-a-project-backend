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
import { User } from './User';
import { AutomationRule } from './AutomationRule';
import { AutomationRun } from './AutomationRun';

export const AUTOMATION_RULE_VERSION_STATES = [
  'draft',
  'published',
  'retired',
] as const;
export type AutomationRuleVersionState =
  (typeof AUTOMATION_RULE_VERSION_STATES)[number];

export type AutomationRuleDefinition = {
  trigger: Record<string, unknown>;
  conditions: Record<string, unknown>[];
  actions: Record<string, unknown>[];
};

@Entity('automation_rule_versions')
@Index('UQ_automation_rule_version_number', ['rule_id', 'version_number'], {
  unique: true,
})
@Index('IDX_automation_rule_versions_rule_state', ['rule_id', 'state'])
export class AutomationRuleVersion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) rule_id: string;
  @ManyToOne(() => AutomationRule, (rule) => rule.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rule_id' })
  rule: AutomationRule;
  @Column({ type: 'int', unsigned: true }) version_number: number;
  @Column({ type: 'enum', enum: AUTOMATION_RULE_VERSION_STATES })
  state: AutomationRuleVersionState;
  @Column({ type: 'int', unsigned: true, default: 1 }) schema_version: number;
  @Column({ type: 'json' }) definition: AutomationRuleDefinition;
  @Column({ type: 'bigint', nullable: true }) created_by_id: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User | null;
  @Column({ type: 'bigint', nullable: true }) published_by_id: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'published_by_id' })
  published_by: User | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  published_at: Date | null;
  @OneToMany(() => AutomationRun, (run) => run.rule_version)
  runs: AutomationRun[];
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
}
