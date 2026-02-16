import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Post } from './typeorm/entities/Post';
import { Profile } from './typeorm/entities/Profile';
import { User } from './typeorm/entities/User';
import { Project } from './typeorm/entities/Project';
import { Task } from './typeorm/entities/Task';
import { Tag } from './typeorm/entities/Tag';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectPeersModule } from './project-peers/project-peers.module';
import { ProjectPeer } from './typeorm/entities/ProjectPeer';
import { Status } from './typeorm/entities/Status';
import { StatusModule } from './status/status.module';
import { MailingModule } from './utils/mailing/mailing.module';
import { UserPeer } from './typeorm/entities/UserPeer';
import { UserPeersModule } from './user-peers/userpeers.module';
import { SeederService } from './seeder/seeder.service';
import { Category } from './typeorm/entities/Category';
import { CategoriesModule } from './categories/categories.module';
import { UserPeerInvite } from './typeorm/entities/UserPeerInvite';
import { NotificationsModule } from './notifications/notifications.module';
import { UserNotificationPreference } from './typeorm/entities/UserNotificationPreference';
import { Notification } from './typeorm/entities/Notification';
import { ProjectPeerInvite } from './typeorm/entities/ProjectPeerInvite';
import { ProjectComment } from './typeorm/entities/ProjectComment';
import { NotesModule } from './notes/notes.module';
import { Note } from './typeorm/entities/Note';
import { ResourcesModule } from './resources/resources.module';
import { DocumentsModule } from './documents/documents.module';
import { Document } from './typeorm/entities/Document';
import { Resource } from './typeorm/entities/Resource';
import { WhiteboardsModule } from './whiteboards/whiteboards.module';
import { Whiteboard } from './typeorm/entities/Whiteboard';
import { ProjectActivitiesModule } from './project-activities/project-activities.module';
import { Conversation } from './typeorm/entities/Conversation';
import { ConversationParticipant } from './typeorm/entities/ConversationParticipant';
import { Message } from './typeorm/entities/Message';
import { MessageReaction } from './typeorm/entities/MessageReaction';
import { MessageReadReceipt } from './typeorm/entities/MessageReadReceipt';
import { MessagesModule } from './messages/messages.module';
import { FoldersModule } from './folders/folders.module';
import { DocumentFile } from './typeorm/entities/DocumentFile';
import { Folder } from './typeorm/entities/Folder';
import { MenusModule } from './menus/menus.module';
import { UserOrganization } from './typeorm/entities/UserOrganization';
import { Organization } from './typeorm/entities/Organization';
import { GlobalMenu } from './typeorm/entities/GlobalMenu';
import { OrganizationMenu } from './typeorm/entities/OrganizationMenu';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectActivity } from './typeorm/entities/ProjectActivity';
@Module({
  imports: [
    // ConfigModule.forRoot({
    //   isGlobal: true,
    //   load: [configuration],
    // }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        // console.log('=== DB CONFIG ===', {
        //   host: process.env.DATABASE_HOST,
        //   port: process.env.DATABASE_PORT,
        //   user: process.env.DATABASE_USERNAME,
        //   password: process.env.DATABASE_PASSWORD,
        //   db: process.env.DATABASE_NAME,
        // });
        return {
          type: 'mysql',
          host: process.env.DATABASE_HOST,
          port: Number(process.env.DATABASE_PORT),
          username: process.env.DATABASE_USERNAME,
          password: process.env.DATABASE_PASSWORD,
          database: process.env.DATABASE_NAME,
          timezone: 'Z',
          ssl: { rejectUnauthorized: false },
          entities: [
            User,
            Profile,
            Post,
            Project,
            Task,
            Tag,
            ProjectPeer,
            ProjectPeerInvite,
            Status,
            UserPeer,
            Category,
            UserPeerInvite,
            Notification,
            UserNotificationPreference,
            ProjectComment,
            Note,
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
            ProjectActivity,
          ],
          synchronize: process.env.NODE_ENV === 'development',
          migrations: ['dist/migrations/**/*{.ts,.js}'],
          autoLoadEntities: true,
          extra: {
            timezone: '+00:00',
          },
        };
      },
    }),
    // TypeOrmModule.forRoot({
    //   type: 'mysql',
    //   host: process.env.DATABASE_HOST,
    //   port: Number(process.env.DATABASE_PORT),
    //   username: process.env.DATABASE_USERNAME,
    //   password: process.env.DATABASE_PASSWORD,
    //   database: process.env.DATABASE_NAME,
    //   timezone: 'Z', // More explicit than 'Z'
    //   // ssl: false,
    //   ssl: { rejectUnauthorized: false },

    //   entities: [
    //     User,
    //     Profile,
    //     Post,
    //     Project,
    //     Task,
    //     Tag,
    //     ProjectPeer,
    //     ProjectPeerInvite,
    //     Status,
    //     UserPeer,
    //     Category,
    //     UserPeerInvite,
    //     Notification,
    //     UserNotificationPreference,
    //     ProjectComment,
    //     Note,
    //     Document,
    //     Resource,
    //     Whiteboard,
    //     Conversation,
    //     ConversationParticipant,
    //     Message,
    //     MessageReaction,
    //     MessageReadReceipt,
    //     DocumentFile,
    //     Folder,
    //     UserOrganization,
    //     OrganizationMenu,
    //     GlobalMenu,
    //     Organization,
    //     ProjectActivity,
    //   ],
    //   synchronize: process.env.NODE_ENV == 'development',
    //   // migrationsRun: true, // Auto-run migrations on startup
    //   migrations: ['dist/migrations/**/*{.ts,.js}'],
    //   autoLoadEntities: true,
    //   extra: {
    //     timezone: '+00:00',
    //     // connectionTimeZone: '+00:00',
    //   },
    // }),
    TypeOrmModule.forFeature([
      User,
      Profile,
      Post,
      Project,
      Task,
      Tag,
      ProjectPeer,
      ProjectPeerInvite,
      Status,
      UserPeer,
      Category,
      UserPeerInvite,
      Notification,
      UserNotificationPreference,
      ProjectComment,
      Note,
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
      ProjectActivity,
    ]),
    UsersModule,
    ProjectsModule,
    StatusModule,
    TasksModule,
    ProjectPeersModule,
    MailingModule,
    AuthModule,
    UserPeersModule,
    CategoriesModule,
    NotificationsModule,
    NotesModule,
    DocumentsModule,
    ResourcesModule,
    WhiteboardsModule,
    ProjectActivitiesModule,
    MessagesModule,
    FoldersModule,
    MenusModule,
    OrganizationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeederService],
})
export class AppModule {}
