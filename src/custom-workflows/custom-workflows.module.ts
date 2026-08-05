import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { ProjectWorkflow } from 'src/typeorm/entities/ProjectWorkflow';
import { ProjectWorkflowStatus } from 'src/typeorm/entities/ProjectWorkflowStatus';
import { ProjectWorkflowTransition } from 'src/typeorm/entities/ProjectWorkflowTransition';
import { ProjectWorkflowVersion } from 'src/typeorm/entities/ProjectWorkflowVersion';
import { Status } from 'src/typeorm/entities/Status';
import { Task } from 'src/typeorm/entities/Task';
import { TaskCustomFieldValue } from 'src/typeorm/entities/TaskCustomFieldValue';
import { TaskTransitionHistory } from 'src/typeorm/entities/TaskTransitionHistory';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import {
  CustomWorkflowsController,
  TaskTransitionHistoryController,
} from './custom-workflows.controller';
import { CustomWorkflowsService } from './custom-workflows.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectWorkflow,
      ProjectWorkflowVersion,
      ProjectWorkflowStatus,
      ProjectWorkflowTransition,
      TaskTransitionHistory,
      TaskCustomFieldValue,
      CustomFieldDefinition,
      Status,
      Task,
      UserOrganization,
    ]),
    AuthorizationModule,
    EntitlementsModule,
  ],
  controllers: [CustomWorkflowsController, TaskTransitionHistoryController],
  providers: [CustomWorkflowsService, OrganizationAccessGuard],
  exports: [CustomWorkflowsService],
})
export class CustomWorkflowsModule {}
