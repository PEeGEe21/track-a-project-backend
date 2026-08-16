import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { AutomationActor } from 'src/typeorm/entities/AutomationActor';
import { AutomationRule } from 'src/typeorm/entities/AutomationRule';
import { AutomationRuleVersion } from 'src/typeorm/entities/AutomationRuleVersion';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { RequestForm } from 'src/typeorm/entities/RequestForm';
import { ReusableTemplate } from 'src/typeorm/entities/ReusableTemplate';
import { Status } from 'src/typeorm/entities/Status';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { AutomationEventsService } from './automation-events.service';
import { AutomationEventSubscriber } from './automation-event.subscriber';
import { AutomationEngineService } from './automation-engine.service';
import { CustomFieldsModule } from 'src/custom-fields/custom-fields.module';
import { AutomationActionAttempt } from 'src/typeorm/entities/AutomationActionAttempt';
import { AutomationEvent } from 'src/typeorm/entities/AutomationEvent';
import { AutomationRun } from 'src/typeorm/entities/AutomationRun';
import { Notification } from 'src/typeorm/entities/Notification';
import { ProjectWorkflowTransition } from 'src/typeorm/entities/ProjectWorkflowTransition';
import { Task } from 'src/typeorm/entities/Task';
import { TaskWatcher } from 'src/typeorm/entities/TaskWatcher';
import { User } from 'src/typeorm/entities/User';
import { AutomationExecutionContextService } from './automation-execution-context.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ProjectsModule } from 'src/projects/projects.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  AutomationRequestContextInterceptor,
  AutomationRequestContextService,
} from './automation-request-context.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AutomationActor,
      AutomationRule,
      AutomationRuleVersion,
      CustomFieldDefinition,
      Project,
      ProjectActivity,
      ProjectPeer,
      RequestForm,
      ReusableTemplate,
      Status,
      UserOrganization,
      AutomationActionAttempt,
      AutomationEvent,
      AutomationRun,
      Notification,
      ProjectWorkflowTransition,
      Task,
      TaskWatcher,
      User,
    ]),
    AuthorizationModule,
    EntitlementsModule,
    CustomFieldsModule,
    NotificationsModule,
    forwardRef(() => ProjectsModule),
  ],
  controllers: [AutomationsController],
  providers: [
    AutomationsService,
    AutomationEventsService,
    AutomationEventSubscriber,
    AutomationEngineService,
    AutomationExecutionContextService,
    AutomationRequestContextService,
    AutomationRequestContextInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: AutomationRequestContextInterceptor,
    },
    OrganizationAccessGuard,
  ],
  exports: [
    AutomationsService,
    AutomationEventsService,
    AutomationRequestContextService,
  ],
})
export class AutomationsModule {}
