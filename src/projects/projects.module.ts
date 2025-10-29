import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectsService } from './services/projects.service';
import { Task } from 'src/typeorm/entities/Task';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { UsersModule } from 'src/users/users.module';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { MailingService } from 'src/utils/mailing/mailing.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Category } from 'src/typeorm/entities/Category';
import { CategoriesModule } from 'src/categories/categories.module';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { ProjectPeerInvite } from 'src/typeorm/entities/ProjectPeerInvite';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { Notification } from 'src/typeorm/entities/Notification';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { ProjectsGateway } from './projects.gateway';
import { Status } from 'src/typeorm/entities/Status';
import { Resource } from 'src/typeorm/entities/resource';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Post,
      Project,
      Task,
      ProjectPeer,
      ProjectPeerInvite,
      ProjectComment,
      Category,
      UserPeer,
      UserPeerInvite,
      Notification,
      UserNotificationPreference,
      Status,
      Resource
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
    // UsersModule,
    MailingModule,
    ConfigModule,
    CategoriesModule,
    // forwardRef(() => CategoriesModule),
    NotificationsModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectsGateway,
    MailingService,
    ConfigService,
    NotificationsService,
    NotificationsGateway,
  ],
  exports: [ProjectsService, ProjectsGateway],
})
export class ProjectsModule {}
