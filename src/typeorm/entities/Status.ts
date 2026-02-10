// src/typeorm/entities/Status.ts
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Task } from './Task';
import { Project } from './Project';
import { Organization } from './Organization';

@Entity({ name: 'status' })
export class Status {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'tab_id', default: 0 })
  tabId: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isDefault: boolean;

  @OneToMany(() => Task, (task) => task.status)
  tasks: Task[];

  @ManyToOne(() => Project, (project) => project.statuses)
  project: Project;

  @ManyToOne(() => User, (user) => user.status)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL'})
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
