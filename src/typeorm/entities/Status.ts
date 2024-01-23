import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './User';
import { Project } from './Project';
import { Tag } from './Tag';
import { Task } from './Task';

@Entity({ name: 'status' })
export class Status {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @OneToMany(() => Task, (task) => task.status)
  tasks: Task[];

  @ManyToOne(() => User, (user) => user.status)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  createdAt: Date = new Date();

  @Column()
  depth: string;
}
