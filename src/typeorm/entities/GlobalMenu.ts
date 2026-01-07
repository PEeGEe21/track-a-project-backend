import { SubscriptionTier } from '../../utils/constants/subscriptionTier';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { OrganizationMenu } from './OrganizationMenu';

@Entity('global_menus')
export class GlobalMenu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  label: string;

  @Column({ length: 255 })
  href: string;

  @Column({ length: 50, nullable: true })
  icon: string;

  @Column({ type: 'uuid', nullable: true })
  parent_id: string;

  @Column({ type: 'int', default: 0 })
  order_index: number;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  required_tier: SubscriptionTier;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => GlobalMenu, (menu) => menu.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: GlobalMenu;

  @OneToMany(() => GlobalMenu, (menu) => menu.parent)
  children: GlobalMenu[];

  @OneToMany(() => OrganizationMenu, (orgMenu) => orgMenu.global_menu)
  organization_menus: OrganizationMenu[];
}