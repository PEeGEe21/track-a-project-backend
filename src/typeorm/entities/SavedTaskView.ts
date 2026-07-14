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
import { User } from './User';

export enum SavedTaskViewVisibility {
  PRIVATE = 'private',
  ORGANIZATION = 'organization',
}

@Entity({ name: 'saved_task_views' })
@Index('IDX_saved_task_views_org_owner', ['organization_id', 'owner_id'])
export class SavedTaskView {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 36,
  })
  organization_id: string;

  @ManyToOne(() => Organization, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({
    type: 'bigint',
  })
  owner_id: number;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({
    type: 'varchar',
    length: 100,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 40,
    default: 'personal_productivity',
  })
  scope: string;

  @Column({
    type: 'json',
  })
  configuration: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: SavedTaskViewVisibility,
    default: SavedTaskViewVisibility.PRIVATE,
  })
  visibility: SavedTaskViewVisibility;

  @Column({
    type: 'boolean',
    default: false,
  })
  is_default: boolean;

  @CreateDateColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
