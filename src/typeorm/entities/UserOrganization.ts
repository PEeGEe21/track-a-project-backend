import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  OneToMany,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GlobalMenu } from './GlobalMenu';
import { Organization } from './Organization';
import { User } from './User';
import { OrganizationRole } from '../../utils/constants/org_roles';

@Entity('user_organizations')
@Unique(['organization_id', 'user_id'])
export class UserOrganization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'bigint' })
  user_id: number;

  @ManyToOne(() => User, (user) => user.user_organizations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Organization, (org) => org.user_organizations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({
    type: 'enum',
    enum: OrganizationRole,
    default: OrganizationRole.MEMBER,
  })
  role: OrganizationRole;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
