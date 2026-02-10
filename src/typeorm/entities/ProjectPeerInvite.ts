import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './User';
import { Project } from './Project';
import { Organization } from './Organization';

@Entity('project_peer_invites')
export class ProjectPeerInvite {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  inviter_user_id: User;

  // Add the project relationship
  @Index()
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', unique: true })
  invite_code: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'accepted', 'expired', 'declined'],
    default: 'pending',
  })
  status: 'pending' | 'accepted' | 'expired' | 'declined';

  @Column({ nullable: true, type: 'timestamp' })
  due_date: Date;

  // Optionally, add a column to track who accepted the invite
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'accepted_by_user_id' })
  accepted_by: User;

  // Optionally, add a column to track when the invite was accepted
  @Column({ nullable: true, type: 'timestamp' })
  accepted_at: Date;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @CreateDateColumn()
  created_at: Date;

  // Add UpdateDateColumn for tracking when records are modified
  @UpdateDateColumn()
  updated_at: Date;
}
