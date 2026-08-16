import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { Task } from './Task';
import { User } from './User';
import { Organization } from './Organization';

@Entity('task_watchers')
@Index('UQ_task_watcher', ['task_id', 'user_id'], { unique: true })
@Index('IDX_task_watchers_org_user', ['organization_id', 'user_id'])
export class TaskWatcher {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() task_id: number;
  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;
  @Column({ type: 'bigint' }) user_id: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
}
