import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';
import { Task } from './Task';
import { Organization } from './Organization';
import { Project } from './Project';

@Entity({ name: 'notes' })
export class Note {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  note: string;

  @Column()
  color?: string;

  @Column({ type: 'boolean', default: false })
  is_pinned: boolean;

  @Column({ type: 'json', nullable: true })
  position: { x: number; y: number };

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'text', nullable: true })
  audio_url: string | null;

  @Column({ type: 'text', nullable: true })
  audio_path: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  audio_mime_type: string | null;

  @Column({ type: 'int', nullable: true })
  audio_duration_seconds: number | null;

  @Column({ type: 'text', nullable: true })
  audio_transcript: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  audio_transcript_status: string | null;

  @Column({ type: 'datetime', nullable: true })
  audio_consent_at: Date | null;

  @Column({ type: 'bigint', nullable: true })
  audio_consent_by_id: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  audio_notice_version: string | null;

  @ManyToOne(() => Task, (task) => task.notes)
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => User, (user) => user.notes)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
