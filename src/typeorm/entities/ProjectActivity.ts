import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Project } from './Project';
import { User } from './User';
import { ActivityType } from '../../utils/constants/activity';
import { Organization } from './Organization';

@Entity('project_activities')
@Index(['project', 'createdAt'])
@Index(['user', 'project'])
export class ProjectActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({
    type: 'enum',
    enum: ActivityType,
    name: 'activity_type',
  })
  activityType: ActivityType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'entity_type' })
  entityType: string; // 'task', 'comment', 'resource', etc.

  @Column({ nullable: true, name: 'entity_id' })
  entityId: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
