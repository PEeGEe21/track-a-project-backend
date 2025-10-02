import {
  Entity,
  ManyToOne,
  JoinColumn,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';
import { Project } from './Project';
import { UserPeerStatus } from '../../utils/constants/userPeerEnums';
import { ProjectPeerStatus } from '../../utils/constants/projectPeerEnums';

@Entity({ name: 'project_peers' })
export class ProjectPeer {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => User, (user) => user.projectPeers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Project, (project) => project.projectPeers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'added_by' })
  addedBy: User;

  @Column({
    type: 'enum',
    enum: ProjectPeerStatus,
    default: ProjectPeerStatus.CONNECTED,
  })
  status: ProjectPeerStatus;

  @Column({ type: 'boolean', default: false })
  is_confirmed: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
