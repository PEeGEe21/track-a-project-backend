import { SubscriptionTier } from '../../utils/constants/subscriptionTier';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrganizationMenu } from './OrganizationMenu';
import { UserOrganization } from './UserOrganization';
import { Project } from './Project';
import { Whiteboard } from './Whiteboard';
import { Task } from './Task';
import { Category } from './Category';
import { Conversation } from './Conversation';
import { ConversationParticipant } from './ConversationParticipant';
import { Document } from './Document';
import { DocumentFile } from './DocumentFile';
import { Folder } from './Folder';
import { Message } from './Message';
import { Note } from './Note';
import { ProjectActivity } from './ProjectActivity';
import { ProjectComment } from './ProjectComment';
import { ProjectPeer } from './ProjectPeer';
import { ProjectPeerInvite } from './ProjectPeerInvite';
import { Resource } from './Resource';
import { Status } from './Status';
import { Tag } from './Tag';
import { UserNotificationPreference } from './UserNotificationPreference';
import { UserPeer } from './UserPeer';
import { UserPeerInvite } from './UserPeerInvite';
import { Notification } from './Notification';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({
    default: '',
  })
  image?: string;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscription_tier: SubscriptionTier;

  @Column({ type: 'int', default: 5 })
  max_users: number;

  @Column({ type: 'int', default: 10 })
  max_projects: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => UserOrganization, (uo) => uo.organization)
  user_organizations: UserOrganization[];

  @OneToMany(() => OrganizationMenu, (orgMenu) => orgMenu.organization)
  organization_menus: OrganizationMenu[];

  @OneToMany(() => Project, (project) => project.organization)
  projects: Project[];

  @OneToMany(() => Whiteboard, (whiteboard) => whiteboard.organization)
  whiteboards: Whiteboard[];

  @OneToMany(() => Category, (category) => category.organization)
  categories: Category[];

  @OneToMany(() => Conversation, (conversation) => conversation.organization)
  conversations: Conversation[];

  @OneToMany(() => ConversationParticipant, (conversation_participant) => conversation_participant.organization)
  conversation_participants: ConversationParticipant[];

  @OneToMany(() => Document, (document) => document.organization)
  documents: Document[];

  @OneToMany(() => DocumentFile, (document_file) => document_file.organization)
  document_files: DocumentFile[];

  @OneToMany(() => Folder, (folder) => folder.organization)
  folders: Folder[];

  @OneToMany(() => Message, (message) => message.organization)
  messages: Message[];

  @OneToMany(() => Note, (note) => note.organization)
  notes: Note[];

  @OneToMany(() => ProjectActivity, (project_activity) => project_activity.organization)
  project_activities: ProjectActivity[];

  @OneToMany(() => ProjectComment, (project_comment) => project_comment.organization)
  project_comments: ProjectComment[];

  @OneToMany(() => ProjectPeer, (project_peer) => project_peer.organization)
  project_peers: ProjectPeer[];

  @OneToMany(() => ProjectPeerInvite, (project_peer_invite) => project_peer_invite.organization)
  project_peer_invites: ProjectPeerInvite[];

  @OneToMany(() => Resource, (resource) => resource.organization)
  resources: Resource[];

  @OneToMany(() => Status, (status) => status.organization)
  statuses: Status[];

  @OneToMany(() => Tag, (tag) => tag.organization)
  tags: Tag[];

  @OneToMany(() => Task, (task) => task.organization)
  tasks: Task[];

  @OneToMany(() => UserNotificationPreference, (userNotificationPreference) => userNotificationPreference.organization)
  user_notification_preferences: UserNotificationPreference[];

  @OneToMany(() => UserPeer, (userPeer) => userPeer.organization)
  user_peers: UserPeer[];

  @OneToMany(() => UserPeerInvite, (userPeerInvite) => userPeerInvite.organization)
  user_peer_invites: UserPeerInvite[];

  @OneToMany(() => Notification, (notification) => notification.organization)
  organization: Notification[];
}
