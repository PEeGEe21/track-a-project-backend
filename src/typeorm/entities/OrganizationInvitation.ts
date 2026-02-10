// src/entities/OrganizationInvitation.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { Organization } from './Organization';
import { v4 as uuidv4 } from 'uuid';
import { OrganizationRole } from '../../utils/constants/org_roles';
import { User } from './User';

@Entity('organization_invitations')
export class OrganizationInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column()
  email: string;

  @Column({ unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: OrganizationRole,
    default: OrganizationRole.MEMBER,
  })
  invited_role: OrganizationRole;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @Column({ default: false })
  accepted: boolean;

  @Column({ type: 'bigint', nullable: true })
  invited_by_id: number; // User ID of who sent the invite

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by' })
  invited_by: User;

  @Column({ type: 'longtext', nullable: true })
  invite_link: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @BeforeInsert()
  generateToken() {
    if (!this.token) {
      this.token = uuidv4();
    }

    // Set expiration to 7 days from now if not set
    if (!this.expires_at) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);
      this.expires_at = expiryDate;
    }
  }
}
