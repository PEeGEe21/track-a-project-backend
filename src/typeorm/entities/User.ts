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
import { Status } from './Status';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    default: '',
  })
  first_name?: string;

  @Column({
    default: '',
  })
  last_name?: string;

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

  @Column({ default: false })
  logged_in: boolean;

  @OneToOne(() => Profile, (profile)=>profile.user)
  @JoinColumn({ name: 'profile_id'})
  profile: Profile;

  // @OneToMany(() => Post, (post) => post.user)
  // posts: Post[];

  @OneToMany(() => Project, (project) => project.user, { cascade: true })
  projects: Project[];

  @OneToMany(() => Status, (status) => status.user, { cascade: true })
  status: Status;

  @ManyToMany(() => ProjectPeer, (projectPeer) => projectPeer.user)
  projectPeers: ProjectPeer[];
}
