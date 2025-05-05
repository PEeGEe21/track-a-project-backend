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

@Entity('user_notification_preferences')
export class UserNotificationPreference {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar' })
  notification_type: string; // e.g., 'invite', 'project_update'

  @Column({ type: 'boolean', default: true })
  in_app: boolean;

  @Column({ type: 'boolean', default: true })
  email: boolean;

  @Column({ type: 'boolean', default: false })
  push: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
