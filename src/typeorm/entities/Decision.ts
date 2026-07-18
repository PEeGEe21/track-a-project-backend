import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './Project';
import { User } from './User';
import { DecisionLink } from './DecisionLink';

export enum DecisionStatus {
  PROPOSED = 'proposed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  SUPERSEDED = 'superseded',
}

@Entity('decisions')
export class Decision {
  @PrimaryGeneratedColumn() id: number;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ length: 255 }) title: string;
  @Column({ type: 'text' }) context: string;
  @Column({ type: 'bigint' }) owner_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;
  @Column({ type: 'bigint' }) created_by_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;
  @Column({ type: 'date' }) decision_date: string;
  @Column({
    type: 'enum',
    enum: DecisionStatus,
    default: DecisionStatus.PROPOSED,
  })
  status: DecisionStatus;
  @Column({ type: 'int', nullable: true }) supersedes_decision_id:
    | number
    | null;
  @ManyToOne(() => Decision, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supersedes_decision_id' })
  supersedes: Decision | null;
  @OneToMany(() => DecisionLink, (link) => link.decision) links: DecisionLink[];
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
