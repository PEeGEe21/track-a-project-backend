import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Project } from './Project';
import { Task } from './Task';
import { User } from './User';
import { Organization } from './Organization';

@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  title: string;

  @Column({ nullable: true })
  type?: string; // 'link', 'file', 'tool', etc.

  @Column({ nullable: true })
  url?: string;

  @Column({ nullable: true })
  file_path?: string;

  @Column({ type: 'bigint', nullable: true })
  file_size?: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  preview_image?: string;

  @Column({ nullable: true })
  preview_title?: string;

  @Column({ type: 'text', nullable: true })
  preview_description?: string;

  @Column({ nullable: true })
  preview_favicon?: string;

  @Column({ nullable: true })
  preview_domain?: string;

  @ManyToOne(() => Project, (project) => project.resources, {
    onDelete: 'CASCADE',
  })
  project: Project;

  @ManyToOne(() => Task, (task) => task.resources, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  task?: Task;

  @ManyToOne(() => User, (user) => user.resources, {
    onDelete: 'SET NULL',
  })
  createdBy: User;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
