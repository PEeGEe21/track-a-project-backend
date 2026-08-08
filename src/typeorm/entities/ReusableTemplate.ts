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
import { ReusableTemplateVersion } from './ReusableTemplateVersion';
export enum ReusableTemplateType {
  TASK = 'task',
  CHECKLIST = 'checklist',
  PROJECT = 'project',
}
@Entity('reusable_templates')
@Index('IDX_reusable_templates_org_type_archive', [
  'organization_id',
  'type',
  'archived_at',
])
export class ReusableTemplate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column({ nullable: true }) source_project_id: number | null;
  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_project_id' })
  source_project: Project | null;
  @Column({ type: 'enum', enum: ReusableTemplateType })
  type: ReusableTemplateType;
  @Column({ length: 180 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'bigint' }) created_by_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;
  @Column({ type: 'datetime', nullable: true }) archived_at: Date | null;
  @OneToMany(() => ReusableTemplateVersion, (v) => v.template)
  versions: ReusableTemplateVersion[];
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
