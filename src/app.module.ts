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
import { AuditExport } from './typeorm/entities/AuditExport';
import { AuditRetentionPolicy } from './typeorm/entities/AuditRetentionPolicy';
import { AuditPurgeRun } from './typeorm/entities/AuditPurgeRun';
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
import { IntakeEvent } from './typeorm/entities/IntakeEvent';
import { IntakeEventAttempt } from './typeorm/entities/IntakeEventAttempt';
import { IntakeImportBatch } from './typeorm/entities/IntakeImportBatch';
import { IntakeImportRow } from './typeorm/entities/IntakeImportRow';
import { IntakeWebhookSource } from './typeorm/entities/IntakeWebhookSource';
import { IntegrationEndpoint } from './typeorm/entities/IntegrationEndpoint';
import { IntegrationPublisherCheckpoint } from './typeorm/entities/IntegrationPublisherCheckpoint';
import { IntegrationDelivery } from './typeorm/entities/IntegrationDelivery';
import { IntegrationDeliveryAttempt } from './typeorm/entities/IntegrationDeliveryAttempt';
import { IntakeEmailAddress } from './typeorm/entities/IntakeEmailAddress';
import { IntakeEmailAttachment } from './typeorm/entities/IntakeEmailAttachment';
import { TaskDeadlineReminder } from './typeorm/entities/TaskDeadlineReminder';
import { OrganizationSettings } from './typeorm/entities/OrganizationSettings';
import { IngestionModule } from './ingestion/ingestion.module';
import { ProjectStatusTemplate } from './typeorm/entities/ProjectStatusTemplate';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { IntegrationDeliveryModule } from './integrations/integration-delivery.module';
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
import { IntakeAiSuggestion } from './typeorm/entities/IntakeAiSuggestion';
import { AiModule } from './ai/ai.module';
import { DataLifecycleEvent } from './typeorm/entities/DataLifecycleEvent';
import { DataLifecycleModule } from './data-lifecycle/data-lifecycle.module';
import { GlobalSearchModule } from './search/global-search.module';
import { CustomFieldDefinition } from './typeorm/entities/CustomFieldDefinition';
import { CustomFieldOption } from './typeorm/entities/CustomFieldOption';
import { TaskCustomFieldValue } from './typeorm/entities/TaskCustomFieldValue';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { CustomWorkflowsModule } from './custom-workflows/custom-workflows.module';
import { Milestone } from './typeorm/entities/Milestone';
import { MilestoneTask } from './typeorm/entities/MilestoneTask';
import { MilestonesModule } from './milestones/milestones.module';
import { RequestForm } from './typeorm/entities/RequestForm';
import { RequestFormVersion } from './typeorm/entities/RequestFormVersion';
import { RequestFormField } from './typeorm/entities/RequestFormField';
import { RequestFormSubmission } from './typeorm/entities/RequestFormSubmission';
import { RequestFormSubmissionAttachment } from './typeorm/entities/RequestFormSubmissionAttachment';
import { RequestFormsModule } from './request-forms/request-forms.module';
import { ApprovalRequest } from './typeorm/entities/ApprovalRequest';
import { ApprovalReviewer } from './typeorm/entities/ApprovalReviewer';
import { ApprovalResponse } from './typeorm/entities/ApprovalResponse';
import { ApprovalsModule } from './approvals/approvals.module';
import { ReusableTemplate } from './typeorm/entities/ReusableTemplate';
import { ReusableTemplateVersion } from './typeorm/entities/ReusableTemplateVersion';
import { TemplatesModule } from './templates/templates.module';
import { AutomationActor } from './typeorm/entities/AutomationActor';
import { AutomationRule } from './typeorm/entities/AutomationRule';
import { AutomationRuleVersion } from './typeorm/entities/AutomationRuleVersion';
import { AutomationEvent } from './typeorm/entities/AutomationEvent';
import { AutomationRun } from './typeorm/entities/AutomationRun';
import { AutomationActionAttempt } from './typeorm/entities/AutomationActionAttempt';
import { AutomationsModule } from './automations/automations.module';
import { TaskWatcher } from './typeorm/entities/TaskWatcher';
import { AuditModule } from './audit/audit.module';
import { TaskDependency } from './typeorm/entities/TaskDependency';
import { TaskDependenciesModule } from './task-dependencies/task-dependencies.module';
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
            AuditExport,
            AuditRetentionPolicy,
            AuditPurgeRun,
            MessageStar,
            UserPushSubscription,
            IngestApiKey,
            IngestedEvent,
            IntakeEvent,
            IntakeEventAttempt,
            IntakeImportBatch,
            IntakeImportRow,
            IntakeWebhookSource,
            IntegrationEndpoint,
            IntegrationPublisherCheckpoint,
            IntegrationDelivery,
            IntegrationDeliveryAttempt,
            IntakeEmailAddress,
            IntakeEmailAttachment,
            IntakeAiSuggestion,
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
            CustomFieldDefinition,
            CustomFieldOption,
            TaskCustomFieldValue,
            Milestone,
            MilestoneTask,
            RequestForm,
            RequestFormVersion,
            RequestFormField,
            RequestFormSubmission,
            RequestFormSubmissionAttachment,
            ApprovalRequest,
            ApprovalReviewer,
            ApprovalResponse,
            ReusableTemplate,
            ReusableTemplateVersion,
            AutomationActor,
            AutomationRule,
            AutomationRuleVersion,
            AutomationEvent,
            AutomationRun,
            AutomationActionAttempt,
            TaskWatcher,
            TaskDependency,
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
      IntakeEvent,
      IntakeEventAttempt,
      TaskDeadlineReminder,
      OrganizationSettings,
      ProjectStatusTemplate,
      UserProjectSidebarPin,
      AiRequestAudit,
      DataLifecycleEvent,
      Milestone,
      MilestoneTask,
      RequestForm,
      RequestFormVersion,
      RequestFormField,
      RequestFormSubmission,
      RequestFormSubmissionAttachment,
      ApprovalRequest,
      ApprovalReviewer,
      ApprovalResponse,
      ReusableTemplate,
      ReusableTemplateVersion,
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
    IntegrationDeliveryModule,
    RecurringTasksModule,
    ProjectUpdatesModule,
    DecisionsModule,
    TaskDiscussionsModule,
    WorkflowsModule,
    SidebarProjectsModule,
    AiModule,
    DataLifecycleModule,
    GlobalSearchModule,
    CustomFieldsModule,
    CustomWorkflowsModule,
    MilestonesModule,
    RequestFormsModule,
    ApprovalsModule,
    TemplatesModule,
    AutomationsModule,
    AuditModule,
    TaskDependenciesModule,
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
