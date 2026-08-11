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
import { Organization } from './Organization';
import { Project } from './Project';
import { User } from './User';
@Entity('intake_email_addresses')
@Index('UQ_intake_email_address_token', ['token'], { unique: true })
@Index('IDX_intake_email_project_active', ['project_id', 'active'])
export class IntakeEmailAddress {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ length: 64 }) token: string;
  @Column({ length: 180 }) name: string;
  @Column({ default: true }) active: boolean;
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5 })
  spam_threshold: number;
  @Column({ type: 'bigint' }) created_by_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
