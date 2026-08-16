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
import { AutomationRule } from './AutomationRule';

@Entity('automation_actors')
@Index('UQ_automation_actor_org_key', ['organization_id', 'stable_key'], {
  unique: true,
})
export class AutomationActor {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column({ type: 'varchar', length: 80, default: 'tailpoint_automation' })
  stable_key: string;
  @Column({ type: 'varchar', length: 180, default: 'Tailpoint Automation' })
  display_name: string;
  @Column({ default: true }) active: boolean;
  @OneToMany(() => AutomationRule, (rule) => rule.execution_actor)
  rules: AutomationRule[];
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
