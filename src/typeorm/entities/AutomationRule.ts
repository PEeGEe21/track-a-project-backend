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
import { User } from './User';
import { AutomationActor } from './AutomationActor';
import { AutomationRuleVersion } from './AutomationRuleVersion';

export const AUTOMATION_AUTHORIZATION_POLICIES = ['editor', 'owner'] as const;
export type AutomationAuthorizationPolicy =
  (typeof AUTOMATION_AUTHORIZATION_POLICIES)[number];

@Entity('automation_rules')
@Index('UQ_automation_rule_project_key', ['project_id', 'stable_key'], {
  unique: true,
})
@Index('IDX_automation_rules_project_active', [
  'project_id',
  'active',
  'archived_at',
])
export class AutomationRule {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ type: 'varchar', length: 80 }) stable_key: string;
  @Column({ type: 'varchar', length: 180 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ default: false }) active: boolean;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  active_since: Date | null;
  @Column({ type: 'enum', enum: AUTOMATION_AUTHORIZATION_POLICIES })
  authorization_policy: AutomationAuthorizationPolicy;
  @Column({ type: 'uuid' }) execution_actor_id: string;
  @ManyToOne(() => AutomationActor, (actor) => actor.rules, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'execution_actor_id' })
  execution_actor: AutomationActor;
  @Column({ type: 'uuid', nullable: true }) published_version_id: string | null;
  @ManyToOne(() => AutomationRuleVersion, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'published_version_id' })
  published_version: AutomationRuleVersion | null;
  @Column({ type: 'uuid', nullable: true }) draft_version_id: string | null;
  @ManyToOne(() => AutomationRuleVersion, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'draft_version_id' })
  draft_version: AutomationRuleVersion | null;
  @Column({ type: 'bigint', nullable: true }) created_by_id: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User | null;
  @Column({ type: 'bigint', nullable: true }) last_material_editor_id:
    | number
    | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_material_editor_id' })
  last_material_editor: User | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  archived_at: Date | null;
  @OneToMany(() => AutomationRuleVersion, (version) => version.rule)
  versions: AutomationRuleVersion[];
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
