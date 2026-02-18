import { forwardRef, Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { AdminController } from './controllers/admin.controller';
import { PassportModule } from '@nestjs/passport';
import { ProjectPeersModule } from 'src/project-peers/project-peers.module';
import { TasksModule } from 'src/tasks/tasks.module';
import { ProjectsModule } from 'src/projects/projects.module';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { UserPeersModule } from 'src/user-peers/userpeers.module';
import { CategoriesModule } from 'src/categories/categories.module';
import { UsersModule } from 'src/users/users.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Profile } from 'src/typeorm/entities/Profile';
import { Project } from 'src/typeorm/entities/Project';
import { Task } from 'src/typeorm/entities/Task';
import { Tag } from 'src/typeorm/entities/Tag';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectPeerInvite } from 'src/typeorm/entities/ProjectPeerInvite';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { Status } from 'src/typeorm/entities/Status';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { Category } from 'src/typeorm/entities/Category';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { Resource } from 'src/typeorm/entities/Resource';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Organization } from 'src/typeorm/entities/Organization';
import { OrganizationInvitation } from 'src/typeorm/entities/OrganizationInvitation';
import { Notification } from 'src/typeorm/entities/Notification';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { MenusModule } from 'src/menus/menus.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    PassportModule,
    ProjectPeersModule,
    TasksModule,
    ProjectsModule,
    MailingModule,
    UserPeersModule,
    CategoriesModule,
    forwardRef(() => UsersModule),
    forwardRef(() => MenusModule),
    forwardRef(() => NotificationsModule),
    ProjectActivitiesModule,
    TypeOrmModule.forFeature([
      User,
      Profile,
      Project,
      Task,
      Tag,
      ProjectPeer,
      ProjectPeerInvite,
      ProjectComment,
      Status,
      UserPeer,
      Category,
      UserPeerInvite,
      Notification,
      UserNotificationPreference,
      Resource,
      ProjectActivity,
      UserOrganization,
      Organization,
      OrganizationInvitation,
      AuditLog,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
