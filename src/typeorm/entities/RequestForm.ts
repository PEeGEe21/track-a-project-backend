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
import { RequestFormVersion } from './RequestFormVersion';

@Entity('request_forms')
@Index('UQ_request_form_public_key', ['public_key'], { unique: true })
@Index('IDX_request_forms_project_archive', ['project_id', 'archived_at'])
export class RequestForm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ type: 'varchar', length: 64 }) public_key: string;
  @Column({ type: 'varchar', length: 180 }) name: string;
  @Column({ type: 'bigint' }) created_by_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;
  @Column({ type: 'datetime', nullable: true }) archived_at: Date | null;
  @OneToMany(() => RequestFormVersion, (version) => version.form)
  versions: RequestFormVersion[];
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
