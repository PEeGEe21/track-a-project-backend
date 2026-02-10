// src/documents/entities/document-file.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './Document';
import { Organization } from './Organization';

@Entity('document_files')
export class DocumentFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimetype: string;

  @Column({ type: 'bigint' })
  size: number; // in bytes

  @Column()
  path: string; // File storage path

  @Column({ nullable: true })
  url: string;

  // Relations
  @ManyToOne(() => Document, (document) => document.files, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Column()
  documentId: string;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @CreateDateColumn()
  uploadedAt: Date;
}
