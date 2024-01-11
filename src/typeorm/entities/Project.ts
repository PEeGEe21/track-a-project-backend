import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { User } from './User';
import { Task } from './Task';

@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

//   @ManyToOne(() => User, (user) => user.posts)
//   post_user: User;

  @ManyToOne(() => User, (user) => user.projects)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Project, (project) => project.tasks)
  tasks: Task[];
}
