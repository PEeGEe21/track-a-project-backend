import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Project } from './Project';
import { User } from './User';
import { Category } from './Category';
import { Folder } from './Folder';
import { DocumentFile } from './DocumentFile';
import { Organization } from './Organization';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column({ type: 'text', nullable: true })
  plainText: string;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    wordCount?: number;
    characterCount?: number;
    readingTime?: number;
  };

  // Relations
  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  author: User;

  @Column()
  userId: number;

  // ADD FOLDER RELATION
  @ManyToOne(() => Folder, (folder) => folder.documents, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'folderId' })
  folder: Folder;

  @Column({ nullable: true })
  folderId: string;

  @Column({ default: false })
  isFavorite: boolean;

  @OneToMany(() => DocumentFile, (file) => file.document, {
    cascade: true,
    eager: true,
  })
  files: DocumentFile[];

  @ManyToOne(() => Category, (category) => category.documents, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  category?: Category;

  @Column({ nullable: true })
  version?: string;

  @ManyToOne(() => Project, (project) => project.documents, {
    onDelete: 'CASCADE',
  })
  project: Project;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;
}
