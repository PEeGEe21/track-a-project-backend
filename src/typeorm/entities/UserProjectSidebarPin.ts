import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { User } from './User';

@Entity('user_project_sidebar_pins')
@Unique('UQ_sidebar_pin_org_user_project', [
  'organization_id',
  'user_id',
  'project_id',
])
@Index('IDX_sidebar_pin_org_user_position', [
  'organization_id',
  'user_id',
  'position',
])
@Check('CHK_sidebar_pin_position', '`position` >= 0')
export class UserProjectSidebarPin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'bigint' })
  user_id: number;

  @Column({ type: 'int' })
  project_id: number;

  @Column({ type: 'int', default: 0 })
  position: number;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
