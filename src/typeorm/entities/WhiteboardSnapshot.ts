import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { User } from './User';
import { Whiteboard } from './Whiteboard';

@Entity('whiteboard_snapshots')
export class WhiteboardSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Whiteboard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'whiteboard_record_id' })
  whiteboard: Whiteboard;

  @Column({ name: 'whiteboard_record_id', type: 'varchar', length: '36' })
  whiteboardRecordId: string;

  @Column()
  whiteboardId: string;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @Column({ name: 'project_id', type: 'int', nullable: true })
  projectId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdById: number | null;

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'longtext', nullable: true })
  thumbnail: string | null;

  @Column({ type: 'json', nullable: true })
  elements: any[] | null;

  @Column({ type: 'json', nullable: true })
  appState: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  files: Record<string, any> | null;

  @Column({ default: 'manual_save' })
  source: string;

  @Column({ type: 'varchar', length: '36', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
