import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { ApprovalRequest } from './ApprovalRequest';
import { User } from './User';
@Entity('approval_reviewers')
@Index('UQ_approval_reviewer', ['request_id', 'reviewer_id'], { unique: true })
export class ApprovalReviewer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) request_id: string;
  @ManyToOne(() => ApprovalRequest, (request) => request.reviewers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request: ApprovalRequest;
  @Column({ type: 'bigint' }) reviewer_id: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;
  @CreateDateColumn() created_at: Date;
}
