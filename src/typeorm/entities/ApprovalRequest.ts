import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { User } from './User';
import { ApprovalReviewer } from './ApprovalReviewer';
import { ApprovalResponse } from './ApprovalResponse';

export enum ApprovalSubjectType {
  TASK = 'task',
  DOCUMENT = 'document',
  MILESTONE = 'milestone',
}
export enum ApprovalRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  INVALIDATED = 'invalidated',
  CANCELLED = 'cancelled',
}

@Entity('approval_requests')
@Index('IDX_approval_requests_project_status', [
  'project_id',
  'status',
  'created_at',
])
@Index('IDX_approval_requests_subject', ['subject_type', 'subject_id'])
export class ApprovalRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ type: 'enum', enum: ApprovalSubjectType })
  subject_type: ApprovalSubjectType;
  @Column({ type: 'varchar', length: 64 }) subject_id: string;
  @Column({ type: 'json' }) subject_snapshot: Record<string, unknown>;
  @Column({ type: 'varchar', length: 64 }) subject_revision: string;
  @Column({
    type: 'enum',
    enum: ApprovalRequestStatus,
    default: ApprovalRequestStatus.PENDING,
  })
  status: ApprovalRequestStatus;
  @Column({ type: 'bigint' }) requested_by_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requested_by_id' })
  requested_by: User;
  @Column({ type: 'text', nullable: true }) message: string | null;
  @Column({ type: 'datetime', nullable: true }) due_at: Date | null;
  @Column({ type: 'boolean', default: false })
  rejection_comment_required: boolean;
  @Column({ type: 'datetime', nullable: true }) resolved_at: Date | null;
  @Column({ type: 'datetime', nullable: true }) reminder_sent_at: Date | null;
  @Column({ type: 'text', nullable: true }) invalidation_reason: string | null;
  @Column({ type: 'json', nullable: true }) policy_snapshot: Record<
    string,
    unknown
  > | null;
  @Column({ type: 'int', default: 0 }) current_stage: number;
  @Column({ type: 'datetime', nullable: true }) escalated_at: Date | null;
  @OneToMany(() => ApprovalReviewer, (reviewer) => reviewer.request)
  reviewers: ApprovalReviewer[];
  @OneToMany(() => ApprovalResponse, (response) => response.request)
  responses: ApprovalResponse[];
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
