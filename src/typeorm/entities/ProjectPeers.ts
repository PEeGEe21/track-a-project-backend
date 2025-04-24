import { Entity, ManyToOne, JoinColumn, Column, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';
import { Project } from './Project';

@Entity({ name: 'project_peers' })
export class ProjectPeer {

  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => User, (user) => user.projectPeers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Project, (project) => project.projectPeers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'added_by' })
  addedBy: User;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
