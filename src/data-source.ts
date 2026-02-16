import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Post } from './typeorm/entities/Post';
import { Profile } from './typeorm/entities/Profile';
import { User } from './typeorm/entities/User';
import { Project } from './typeorm/entities/Project';
import { Task } from './typeorm/entities/Task';
import { Tag } from './typeorm/entities/Tag';
import { ProjectPeer } from './typeorm/entities/ProjectPeer';
import { Status } from './typeorm/entities/Status';
import { UserPeer } from './typeorm/entities/UserPeer';
import { Category } from './typeorm/entities/Category';
import { Note } from './typeorm/entities/Note';
import { ProjectComment } from './typeorm/entities/ProjectComment';
import { UserOrganization } from './typeorm/entities/UserOrganization';
import { OrganizationMenu } from './typeorm/entities/OrganizationMenu';
import { GlobalMenu } from './typeorm/entities/GlobalMenu';
import { Organization } from './typeorm/entities/Organization';
import { Document } from './typeorm/entities/Document';
import { Folder } from './typeorm/entities/Folder';
import { Resource } from './typeorm/entities/Resource';
import { Whiteboard } from './typeorm/entities/Whiteboard';
import { Conversation } from './typeorm/entities/Conversation';
import { ConversationParticipant } from './typeorm/entities/ConversationParticipant';
import { Message } from './typeorm/entities/Message';
import { MessageReaction } from './typeorm/entities/MessageReaction';
import { MessageReadReceipt } from './typeorm/entities/MessageReadReceipt';
import { DocumentFile } from './typeorm/entities/DocumentFile';
import { ProjectActivity } from './typeorm/entities/ProjectActivity';
import { OrganizationInvitation } from './typeorm/entities/OrganizationInvitation';
import { UserPeerInvite } from './typeorm/entities/UserPeerInvite';
import { UserNotificationPreference } from './typeorm/entities/UserNotificationPreference';
import { Notification } from './typeorm/entities/Notification';
import { ProjectPeerInvite } from './typeorm/entities/ProjectPeerInvite';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: false },
  synchronize: false, // or true for local dev
  migrations: [
    process.env.NODE_ENV === 'production'
      ? 'dist/migrations/*.js'
      : 'src/migrations/*.ts',
  ],
  entities: [
    User,
    Profile,
    Post,
    Project,
    Task,
    Tag,
    ProjectPeer,
    Status,
    UserPeer,
    UserPeerInvite,
    Category,
    Note,
    ProjectComment,
    ProjectPeerInvite,
    ProjectActivity,
    Document,
    Resource,
    Whiteboard,
    Conversation,
    ConversationParticipant,
    Message,
    MessageReaction,
    MessageReadReceipt,
    DocumentFile,
    Folder,
    UserOrganization,
    OrganizationMenu,
    GlobalMenu,
    Organization,
    OrganizationInvitation,
    Notification,
    UserNotificationPreference,
  ],
  migrationsTransactionMode: 'each',
});
