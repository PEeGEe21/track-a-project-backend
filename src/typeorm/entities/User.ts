import {
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Post } from './Post';
import { Profile } from './Profile';
import { Project } from './Project';
import { ProjectPeer } from './ProjectPeers';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  createdAt: Date;

  @Column({ nullable: true })
  authStrategy: string;

  @OneToOne(() => Profile)
  @JoinColumn()
  profile: Profile;

  // @OneToMany(() => Post, (post) => post.user)
  // posts: Post[];

  @OneToMany(() => Project, (project) => project.user, { cascade: true })
  projects: Project[];

  @ManyToMany(() => ProjectPeer, (projectPeer) => projectPeer.user)
  projectPeers: ProjectPeer[];
}
