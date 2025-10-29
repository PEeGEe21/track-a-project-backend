import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './Project';
import { User } from './User';

@Entity('whiteboards')
export class Whiteboard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  whiteboardId: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  elements: any[];

  @Column({ type: 'json', nullable: true })
  appState: any;

  @Column({ type: 'json', nullable: true })
  files: any;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'last_modified_by' })
  lastModifiedBy: User;

  @Column({ type: 'longtext', nullable: true })
  thumbnail: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Project, (project) => project.whiteboards, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @ManyToOne(() => User, (user) => user.whiteboards)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
