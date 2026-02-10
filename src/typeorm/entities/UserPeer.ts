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
import { UserPeerStatus } from '../../utils/constants/userPeerEnums';
import { Organization } from './Organization';

@Entity('user_peers')
export class UserPeer {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'peer_id' })
  peer: User;

  @Column({
    type: 'enum',
    enum: UserPeerStatus,
    default: UserPeerStatus.CONNECTED,
  })
  status: UserPeerStatus; // e.g., 'connected', 'pending', 'blocked'

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: false })
  is_confirmed: boolean;

  @Column({ type: 'varchar', nullable: true })
  connection_type: string;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
