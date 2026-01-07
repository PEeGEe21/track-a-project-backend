import { SubscriptionTier } from '../../utils/constants/subscriptionTier';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrganizationMenu } from './OrganizationMenu';
import { UserOrganization } from './UserOrganization';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscription_tier: SubscriptionTier;

  @Column({ type: 'int', default: 5 })
  max_users: number;

  @Column({ type: 'int', default: 10 })
  max_projects: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => UserOrganization, (uo) => uo.organization)
  user_organizations: UserOrganization[];

  @OneToMany(() => OrganizationMenu, (orgMenu) => orgMenu.organization)
  organization_menus: OrganizationMenu[];
}
