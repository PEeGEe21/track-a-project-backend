// src/documents/entities/folder.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Tree,
  TreeChildren,
  TreeParent,
} from 'typeorm';
import { User } from './User';
import { Document } from './Document';
import { Organization } from './Organization';

@Entity('folders')
@Tree('closure-table')
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  icon: string;

  // User relation
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  owner: User;

  @Column()
  userId: number;

  // Hierarchical structure
  @TreeParent()
  parent: Folder;

  @Column({ nullable: true })
  parentId: string;

  @TreeChildren()
  children: Folder[];

  // Documents in this folder
  @OneToMany(() => Document, (document) => document.folder)
  documents: Document[];

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
