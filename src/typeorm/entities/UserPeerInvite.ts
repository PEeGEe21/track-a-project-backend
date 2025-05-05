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

@Entity('user_peer_invites')
export class UserPeerInvite {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  inviter_user_id: User;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', unique: true })
  invite_code: string;

  @Column({ type: 'varchar' })
  invited_as: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'accepted', 'expired', 'declined'],
    default: 'pending',
  })
  status: 'pending' | 'accepted' | 'expired' | 'declined';

  @Column({ nullable: true, type: 'timestamp' })
  due_date: Date;
  
  @CreateDateColumn()
  created_at: Date;
}
