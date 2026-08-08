import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { Task } from './Task';
import { User } from './User';
import { RequestForm } from './RequestForm';
import { RequestFormVersion } from './RequestFormVersion';
import { RequestFormSubmissionAttachment } from './RequestFormSubmissionAttachment';

export enum RequestFormSubmissionStatus {
  RECEIVED = 'received',
  PENDING_REVIEW = 'pending_review',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  QUARANTINED = 'quarantined',
  FAILED = 'failed',
}

@Entity('request_form_submissions')
@Index('IDX_request_form_submission_form_created', ['form_id', 'created_at'])
@Index('IDX_request_form_submission_project_created', [
  'project_id',
  'created_at',
])
export class RequestFormSubmission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ type: 'uuid' }) form_id: string;
  @ManyToOne(() => RequestForm, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'form_id' })
  form: RequestForm;
  @Column({ type: 'uuid' }) version_id: string;
  @ManyToOne(() => RequestFormVersion, (version) => version.submissions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'version_id' })
  version: RequestFormVersion;
  @Column({ nullable: true }) task_id: number | null;
  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task: Task | null;
  @Column({ type: 'bigint', nullable: true }) submitted_by_id: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'submitted_by_id' })
  submitted_by: User | null;
  @Column({ type: 'varchar', length: 255, nullable: true })
  submitter_email: string | null;
  @Column({ type: 'enum', enum: RequestFormSubmissionStatus })
  status: RequestFormSubmissionStatus;
  @Column({ type: 'json' }) answers_snapshot: unknown;
  @Column({ type: 'json', nullable: true }) validation_snapshot: unknown;
  @Column({ type: 'varchar', length: 64, nullable: true })
  source_ip_hash: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true })
  user_agent: string | null;
  @Column({ type: 'text', nullable: true }) failure_reason: string | null;
  @Column({ type: 'bigint', nullable: true }) reviewed_by_id: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewed_by: User | null;
  @Column({ type: 'datetime', nullable: true }) reviewed_at: Date | null;
  @Column({ type: 'text', nullable: true }) review_note: string | null;
  @OneToMany(
    () => RequestFormSubmissionAttachment,
    (attachment) => attachment.submission,
  )
  attachments: RequestFormSubmissionAttachment[];
  @CreateDateColumn() created_at: Date;
}
