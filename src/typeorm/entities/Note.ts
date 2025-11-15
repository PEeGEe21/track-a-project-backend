import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';
import { Task } from './Task';

@Entity({ name: 'notes' })
export class Note {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  note: string;

  @Column()
  color?: string;

  @Column({ type: 'boolean', default: false })
  is_pinned: boolean;

  @Column({ type: 'json', nullable: true })
  position: { x: number; y: number };

  @Column({ type: 'int', default: 0 })
  order: number;

  @ManyToOne(() => Task, (task) => task.notes)
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => User, (user) => user.notes)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
