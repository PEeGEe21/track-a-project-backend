import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';

@Entity('organization_settings')
export class OrganizationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  organization_id: string;

  @OneToOne(() => Organization, (organization) => organization.settings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'boolean', default: false })
  deadline_reminders_enabled: boolean;

  @Column({ type: 'int', default: 3 })
  deadline_reminder_days_before: number;

  @Column({ type: 'int', default: 9 })
  deadline_reminder_hour: number;

  @Column({ type: 'int', default: 0 })
  deadline_reminder_minute: number;

  @Column({ type: 'json', nullable: true })
  feature_overrides: Record<string, boolean> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
