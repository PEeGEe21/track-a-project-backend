import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Post } from './Post';
import { Profile } from './Profile';
import { Project } from './Project';
import { ProjectPeer } from './ProjectPeers';
import { Status } from './Status';
import { Task } from './Task';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    default: '',
  })
  avatar?: string;

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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  authStrategy: string;

  @Column({ default: false })
  logged_in: boolean;

  @OneToOne(() => Profile, (profile) => profile.user)
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  // @OneToMany(() => Post, (post) => post.user)
  // posts: Post[];

  @OneToMany(() => Project, (project) => project.user, { cascade: true })
  projects: Project[];

  @OneToMany(() => Task, (task) => task.user, { cascade: true })
  tasks: Task[];

  @OneToMany(() => Status, (status) => status.user, { cascade: true })
  status: Status;

  // @ManyToMany(() => ProjectPeer, (projectPeer) => projectPeer.user)
  // projectPeers: ProjectPeer[];

  @OneToMany(() => ProjectPeer, (projectPeer) => projectPeer.user)
  projectPeers: ProjectPeer[];
}
