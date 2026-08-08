import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { ApprovalRequest } from './ApprovalRequest';
import { User } from './User';
export enum ApprovalDecision {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}
@Entity('approval_responses')
@Index('UQ_approval_response_reviewer', ['request', 'reviewer'], {
  unique: true,
})
export class ApprovalResponse {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => ApprovalRequest, (request) => request.responses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  request: ApprovalRequest;
  @RelationId((response: ApprovalResponse) => response.request)
  request_id: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;
  @RelationId((response: ApprovalResponse) => response.reviewer)
  reviewer_id: number;
  @Column({ type: 'enum', enum: ApprovalDecision }) decision: ApprovalDecision;
  @Column({ type: 'text', nullable: true }) comment: string | null;
  @Column({ type: 'json' }) subject_snapshot: Record<string, unknown>;
  @CreateDateColumn() created_at: Date;
}
