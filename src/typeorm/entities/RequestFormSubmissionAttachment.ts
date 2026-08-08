import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RequestFormSubmission } from './RequestFormSubmission';

export enum RequestFormAttachmentStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  QUARANTINED = 'quarantined',
  REJECTED = 'rejected',
}

@Entity('request_form_submission_attachments')
export class RequestFormSubmissionAttachment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) submission_id: string;
  @ManyToOne(
    () => RequestFormSubmission,
    (submission) => submission.attachments,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'submission_id' })
  submission: RequestFormSubmission;
  @Column({ type: 'varchar', length: 255 }) original_name: string;
  @Column({ type: 'varchar', length: 255 }) storage_key: string;
  @Column({ type: 'varchar', length: 180 }) mime_type: string;
  @Column({ type: 'bigint', unsigned: true }) size_bytes: number;
  @Column({ type: 'varchar', length: 64, nullable: true }) sha256: string | null;
  @Column({ type: 'enum', enum: RequestFormAttachmentStatus })
  status: RequestFormAttachmentStatus;
  @CreateDateColumn() created_at: Date;
}
