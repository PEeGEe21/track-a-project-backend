import {
  Entity,
  ManyToOne,
  JoinColumn,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './Project';
import { User } from './User';
import { Organization } from './Organization';
@Entity({ name: 'project_comments' })
export class ProjectComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, (project) => project.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column()
  projectId: number; // FK to Project

  @ManyToOne(() => User, (user) => user.projectComments, {
    onDelete: 'SET NULL', // Or 'CASCADE' depending on your business logic
  })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column()
  authorId: number;

  @Column({ type: 'longtext', nullable: true })
  content: string; // text content

  @Column({ nullable: true })
  fileUrl: string; // attachment URL (image/file)

  @Column('json', { nullable: true })
  reactions: { userId: number; emoji: string }[];

  @Column('simple-array', { nullable: true })
  seenBy: string[];

  @Column('simple-array', { nullable: true })
  mentions: string[];

  @Column({ default: false })
  is_me: boolean;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
