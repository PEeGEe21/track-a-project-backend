import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';
import { Project } from './Project';
import { Task } from './Task';

@Entity({ name: 'categories' })
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @ManyToMany(() => Task, (task) => task.categories)
  tasks: Task[];

  @ManyToMany(() => Project, (project) => project.categories)
  projects: Project[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
