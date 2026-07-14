import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
import { TasksController } from './controllers/tasks.controller';
import { TasksService } from './services/tasks.service';
import { Task } from 'src/typeorm/entities/Task';
import { Status } from 'src/typeorm/entities/Status';
import { Note } from 'src/typeorm/entities/Note';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { Notification } from 'src/typeorm/entities/Notification';
import { UsersModule } from 'src/users/users.module';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';
import { Organization } from 'src/typeorm/entities/Organization';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Resource } from 'src/typeorm/entities/Resource';
import { StorageModule } from 'src/storage/storage.module';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { SavedTaskView } from 'src/typeorm/entities/SavedTaskView';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Post,
      Project,
      Task,
      Status,
      Note,
      Notification,
      UserNotificationPreference,
      ProjectActivity,
      Organization,
      UserOrganization,
      Resource,
      SavedTaskView,
    ]),
    forwardRef(() => UsersModule),
    NotificationsModule,
    ProjectActivitiesModule,
    StorageModule,
    AuthorizationModule,
    EntitlementsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, OrganizationAccessGuard],
  exports: [TasksService],
})
export class TasksModule {}
