import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';
import { Task } from './Task';
import { ProjectPeer } from './ProjectPeer';
import { Tag } from './Tag';
import { Category } from './Category';
import { ProjectComment } from './ProjectComment';
import { Resource } from './Resource';
import { Document } from './Document';
import { Whiteboard } from './Whiteboard';
import { Status } from './Status';
import { ProjectStatus } from '../../utils/constants/project';
import { Organization } from './Organization';
import { ProjectIngestionSettings } from './ProjectIngestionSettings';

@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'longtext', nullable: true })
  description: string;

  @Column({ type: 'longtext', nullable: true })
  description_html: string | null;

  @ManyToMany(() => Tag)
  @JoinTable()
  tags?: Tag[];

  @ManyToMany(() => Category)
  @JoinTable()
  categories?: Category[];

  // @Column({ nullable: true })
  // category: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  icon: string;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.ACTIVE,
  })
  status: ProjectStatus;

  @Column({ nullable: true }) // Added created_at column
  due_date: Date = new Date();

  // @Column({
  //   type: 'enum',
  //   enum: ProjectStatus,
  //   default: ProjectStatus.ACTIVE,
  // })
  // project_status: ProjectStatus;

  // project.entity.ts
  @OneToMany(() => Status, (status) => status.project)
  statuses: Status[];

  @Column({ nullable: true })
  default_ingestion_status_id: number | null;

  @ManyToOne(() => Status, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'default_ingestion_status_id' })
  defaultIngestionStatus: Status | null;

  @OneToOne(
    () => ProjectIngestionSettings,
    (ingestionSettings) => ingestionSettings.project,
  )
  ingestionSettings?: ProjectIngestionSettings | null;

  //   @ManyToOne(() => User, (user) => user.posts)
  //   post_user: User;
  // @ManyToMany(() => ProjectPeer, (projectPeer) => projectPeer.project)
  // projectPeers: ProjectPeer[];

  @OneToMany(() => ProjectPeer, (projectPeer) => projectPeer.project)
  projectPeers: ProjectPeer[];

  @ManyToOne(() => User, (user) => user.projects)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Organization that owns this project
  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProjectComment, (comment) => comment.project)
  comments: ProjectComment[];

  @OneToMany(() => Whiteboard, (whiteboard) => whiteboard.project)
  whiteboards: Whiteboard[];

  @OneToMany(() => Document, (document) => document.project)
  documents: Document[];

  @OneToMany(() => Resource, (resource) => resource.project)
  resources: Resource[];
}
