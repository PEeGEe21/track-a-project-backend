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
import { Profile } from './Profile';
import { Project } from './Project';
import { ProjectPeer } from './ProjectPeer';
import { Status } from './Status';
import { Task } from './Task';
import { ProjectComment } from './ProjectComment';
import { Note } from './Note';
import { Resource } from './resource';
import { Document } from './Document';
import { Whiteboard } from './Whiteboard';
import { Message } from './Message';
import { ConversationParticipant } from './ConversationParticipant';
import { UserPeer } from './UserPeer';
import { UserOrganization } from './UserOrganization';
import { UserRole } from '../../utils/constants/user_roles';
import { Exclude, Expose } from 'class-transformer';

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

  @Exclude()
  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  role: UserRole;

  @Column({ default: true })
  is_active: boolean;

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

  @OneToMany(() => Note, (note) => note.user, { cascade: true })
  notes: Note[];

  @OneToMany(() => Status, (status) => status.user, { cascade: true })
  status: Status;

  // @ManyToMany(() => ProjectPeer, (projectPeer) => projectPeer.user)
  // projectPeers: ProjectPeer[];

  @OneToMany(() => ProjectPeer, (projectPeer) => projectPeer.user)
  projectPeers: ProjectPeer[];

  @OneToMany(() => UserPeer, (userPeer) => userPeer.user)
  userPeers: UserPeer[];

  @OneToMany(() => Whiteboard, (whiteboard) => whiteboard.user)
  whiteboards: Whiteboard[];

  @OneToMany(() => ProjectComment, (comment) => comment.author)
  projectComments: ProjectComment[];

  @OneToMany(() => Message, (message) => message.sender)
  sentMessages: Message[];

  @OneToMany(() => ConversationParticipant, (participant) => participant.user)
  conversationParticipants: ConversationParticipant[];

  @OneToMany(() => Document, (document) => document.project)
  documents: Document[];

  @OneToMany(() => Resource, (resource) => resource.project)
  resources: Resource[];

  @OneToMany(() => UserOrganization, (uo) => uo.user)
  user_organizations: UserOrganization[];

  @Expose()
  get fullName(): string {
    return `${this.first_name ?? ''} ${this.last_name ?? ''}`.trim();
  }
}
