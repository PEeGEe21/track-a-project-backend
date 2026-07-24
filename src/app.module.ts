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
import { WhiteboardSnapshot } from './typeorm/entities/WhiteboardSnapshot';
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
import { BillingModule } from './billing/billing.module';
import { ScheduleModule } from '@nestjs/schedule';
import { Subscription } from './typeorm/entities/Subscription';
import { Price } from './typeorm/entities/Price';
import { Invoice } from './typeorm/entities/Invoice';
import { Plan } from './typeorm/entities/Plan';
import { AuditLog } from './typeorm/entities/AuditLog';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { config } from './config';
import { RedisModule } from './redis/redis.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RedisThrottlerStorage } from './common/rate-limit/redis-throttler.storage';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { MessageStar } from './typeorm/entities/MessageStar';
import { UserPushSubscription } from './typeorm/entities/UserPushSubscription';
import { IngestApiKey } from './typeorm/entities/IngestApiKey';
import { IngestedEvent } from './typeorm/entities/IngestedEvent';
import { TaskDeadlineReminder } from './typeorm/entities/TaskDeadlineReminder';
import { OrganizationSettings } from './typeorm/entities/OrganizationSettings';
import { IngestionModule } from './ingestion/ingestion.module';
import { ProjectStatusTemplate } from './typeorm/entities/ProjectStatusTemplate';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { TaskRecurrence } from './typeorm/entities/TaskRecurrence';
import { TaskRecurrenceOccurrence } from './typeorm/entities/TaskRecurrenceOccurrence';
import { RecurringTasksModule } from './recurring-tasks/recurring-tasks.module';
import { SavedTaskView } from './typeorm/entities/SavedTaskView';
import { ProjectUpdate } from './typeorm/entities/ProjectUpdate';
import { ProjectUpdateReference } from './typeorm/entities/ProjectUpdateReference';
import { ProjectUpdatesModule } from './project-updates/project-updates.module';
import { Decision } from './typeorm/entities/Decision';
import { DecisionLink } from './typeorm/entities/DecisionLink';
import { DecisionHistory } from './typeorm/entities/DecisionHistory';
import { DecisionsModule } from './decisions/decisions.module';
import { TaskComment } from './typeorm/entities/TaskComment';
import { TaskCommentReaction } from './typeorm/entities/TaskCommentReaction';
import { TaskCommentEdit } from './typeorm/entities/TaskCommentEdit';
import { TaskDiscussionsModule } from './task-discussions/task-discussions.module';
import { WorkConversion } from './typeorm/entities/WorkConversion';
import { WorkflowTemplate } from './typeorm/entities/WorkflowTemplate';
import { WorkflowStep } from './typeorm/entities/WorkflowStep';
import { WorkflowsModule } from './workflows/workflows.module';
import { UserProjectSidebarPin } from './typeorm/entities/UserProjectSidebarPin';
import { SidebarProjectsModule } from './sidebar-projects/sidebar-projects.module';
import { AiRequestAudit } from './typeorm/entities/AiRequestAudit';
import { AiModule } from './ai/ai.module';
import { DataLifecycleEvent } from './typeorm/entities/DataLifecycleEvent';
import { DataLifecycleModule } from './data-lifecycle/data-lifecycle.module';
import { GlobalSearchModule } from './search/global-search.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RedisModule,
    RateLimitModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [RateLimitModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        throttlers: [
          {
            name: 'default',
            ttl: config.rateLimit.defaultWindowMs,
            limit: config.rateLimit.defaultMax,
            blockDuration: config.rateLimit.defaultWindowMs,
          },
        ],
        getTracker: (req) =>
          String(req.user?.userId ?? req.ip ?? req.ips?.[0] ?? 'anonymous'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
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
            WhiteboardSnapshot,
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
            Subscription,
            Price,
            Invoice,
            Plan,
            AuditLog,
            MessageStar,
            UserPushSubscription,
            IngestApiKey,
            IngestedEvent,
            TaskDeadlineReminder,
            OrganizationSettings,
            ProjectStatusTemplate,
            TaskRecurrence,
            TaskRecurrenceOccurrence,
            SavedTaskView,
            ProjectUpdate,
            ProjectUpdateReference,
            Decision,
            DecisionLink,
            DecisionHistory,
            TaskComment,
            TaskCommentReaction,
            TaskCommentEdit,
            WorkConversion,
            WorkflowTemplate,
            WorkflowStep,
            UserProjectSidebarPin,
            AiRequestAudit,
            DataLifecycleEvent,
          ],
          synchronize: false,
          migrationsRun: config.db.runMigrationsOnStartup,
          migrations: ['dist/migrations/**/*{.ts,.js}'],
          autoLoadEntities: true,
          extra: {
            timezone: '+00:00',
          },
        };
      },
    }),
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
      WhiteboardSnapshot,
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
      Subscription,
      Price,
      Invoice,
      Plan,
      AuditLog,
      MessageStar,
      UserPushSubscription,
      IngestApiKey,
      IngestedEvent,
      TaskDeadlineReminder,
      OrganizationSettings,
      ProjectStatusTemplate,
      UserProjectSidebarPin,
      AiRequestAudit,
      DataLifecycleEvent,
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
    BillingModule,
    AdminModule,
    HealthModule,
    IngestionModule,
    EntitlementsModule,
    RecurringTasksModule,
    ProjectUpdatesModule,
    DecisionsModule,
    TaskDiscussionsModule,
    WorkflowsModule,
    SidebarProjectsModule,
    AiModule,
    DataLifecycleModule,
    GlobalSearchModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SeederService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
