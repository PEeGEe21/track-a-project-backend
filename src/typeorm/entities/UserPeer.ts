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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
