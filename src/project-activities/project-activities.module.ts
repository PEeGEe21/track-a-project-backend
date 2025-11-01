import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
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
import { Status } from 'src/typeorm/entities/Status';
import { Resource } from 'src/typeorm/entities/resource';
import { AuthModule } from 'src/auth/auth.module';
import { ProjectActivitiesService } from './services/project-activities.service';
import { ProjectActivitiesController } from './controllers/project-activities.controller';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';

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
      Resource,
      ProjectActivity
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
    forwardRef(() => NotificationsModule),
    // UsersModule,
    MailingModule,
    ConfigModule,
    CategoriesModule,
    // NotificationsModule,
  ],
  controllers: [ProjectActivitiesController],
  providers: [ProjectActivitiesService],
  exports: [ProjectActivitiesService],
})
export class ProjectActivitiesModule {}
