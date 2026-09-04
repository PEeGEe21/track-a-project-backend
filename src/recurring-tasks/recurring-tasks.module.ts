import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { Task } from 'src/typeorm/entities/Task';
import { TaskRecurrence } from 'src/typeorm/entities/TaskRecurrence';
import { TaskRecurrenceOccurrence } from 'src/typeorm/entities/TaskRecurrenceOccurrence';
import { TaskRecurrenceException } from 'src/typeorm/entities/TaskRecurrenceException';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Status } from 'src/typeorm/entities/Status';
import { RecurringTasksController } from './recurring-tasks.controller';
import { RecurringTasksService } from './recurring-tasks.service';
import { TaskDependency } from 'src/typeorm/entities/TaskDependency';
import { ReusableTemplateVersion } from 'src/typeorm/entities/ReusableTemplateVersion';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskRecurrence,
      TaskRecurrenceOccurrence,
      TaskRecurrenceException,
      UserOrganization,
      Status,
      TaskDependency,
      ReusableTemplateVersion,
    ]),
    AuthorizationModule,
    EntitlementsModule,
  ],
  controllers: [RecurringTasksController],
  providers: [RecurringTasksService, OrganizationAccessGuard],
  exports: [RecurringTasksService],
})
export class RecurringTasksModule {}
