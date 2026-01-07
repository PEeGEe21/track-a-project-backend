import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { GlobalMenu } from './GlobalMenu';
import { Organization } from './Organization';

@Entity('organization_menus')
@Unique(['organization_id', 'global_menu_id'])
export class OrganizationMenu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  global_menu_id: string;

  @Column({ default: true })
  is_enabled: boolean;

  @Column({ length: 100, nullable: true })
  custom_label: string;

  @Column({ type: 'int', nullable: true })
  order_index: number;

  @ManyToOne(() => Organization, (org) => org.organization_menus)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => GlobalMenu, (menu) => menu.organization_menus)
  @JoinColumn({ name: 'global_menu_id' })
  global_menu: GlobalMenu;
}
