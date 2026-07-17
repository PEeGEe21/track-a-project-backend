import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { User } from './User';
import { ProjectUpdateReference } from './ProjectUpdateReference';

export enum ProjectUpdateHealth { ON_TRACK = 'on_track', AT_RISK = 'at_risk', OFF_TRACK = 'off_track' }
export enum ProjectUpdateStatus { DRAFT = 'draft', PUBLISHED = 'published' }

@Entity('project_updates')
export class ProjectUpdate {
  @PrimaryGeneratedColumn() id: number;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'project_id' }) project: Project;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ type: 'bigint' }) author_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'author_id' }) author: User;
  @Column({ type: 'enum', enum: ProjectUpdateHealth }) health: ProjectUpdateHealth;
  @Column({ type: 'longtext', nullable: true }) accomplishments: string | null;
  @Column({ type: 'longtext', nullable: true }) blockers: string | null;
  @Column({ type: 'longtext', nullable: true }) next_steps: string | null;
  @Column({ type: 'date', nullable: true }) reporting_period_start: string | null;
  @Column({ type: 'date', nullable: true }) reporting_period_end: string | null;
  @Column({ type: 'enum', enum: ProjectUpdateStatus, default: ProjectUpdateStatus.DRAFT }) status: ProjectUpdateStatus;
  @Column({ nullable: true }) series_id: number | null;
  @Column({ nullable: true }) corrects_update_id: number | null;
  @ManyToOne(() => ProjectUpdate, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'corrects_update_id' }) corrects: ProjectUpdate | null;
  @Column({ default: 1 }) version: number;
  @Column({ default: true }) is_latest: boolean;
  @Column({ type: 'datetime', nullable: true }) published_at: Date | null;
  @OneToMany(() => ProjectUpdateReference, (reference) => reference.update, { cascade: true }) references: ProjectUpdateReference[];
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
