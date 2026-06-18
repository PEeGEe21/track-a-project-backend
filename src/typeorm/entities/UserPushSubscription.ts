import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';

@Entity('user_push_subscriptions')
export class UserPushSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 1024 })
  endpoint: string;

  @Column({ type: 'char', length: 64, unique: true })
  endpoint_hash: string;

  @Column({ type: 'varchar', length: 255 })
  p256dh: string;

  @Column({ type: 'varchar', length: 255 })
  auth: string;

  @Column({ type: 'bigint', nullable: true })
  expiration_time: number | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  user_agent: string | null;

  @Column({ type: 'timestamp', nullable: true })
  last_seen_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
