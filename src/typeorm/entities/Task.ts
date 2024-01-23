import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Project } from './Project';
import { Tag } from './Tag';
import { Status } from './Status';

@Entity({ name: 'tasks' })
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({
    default: false,
  })
  priority: Boolean;

  @ManyToMany(() => Tag)
  @JoinTable()
  tags?: Tag[];

  @Column()
  dueDate: Date;

  @Column()
  createdAt: Date = new Date();;

  @ManyToOne(() => Project, (project) => project.tasks)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Status, (status) => status.tasks)
  @JoinColumn({ name: 'status_id' })
  status: Status;
}
