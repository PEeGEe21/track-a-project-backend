import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './Project';
import { User } from './User';
import { Category } from './Category';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  title: string;

  @ManyToOne(() => Category, (category) => category.documents, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  category?: Category;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ nullable: true })
  file_path?: string;

  @Column({ nullable: true })
  version?: string;

  @ManyToOne(() => Project, (project) => project.documents, {
    onDelete: 'CASCADE',
  })
  project: Project;

  @ManyToOne(() => User, (user) => user.documents, {
    onDelete: 'SET NULL',
  })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
