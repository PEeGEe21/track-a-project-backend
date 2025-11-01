import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { UsersController } from './controllers//users.controller';
import { UsersService } from './services/users.service';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { JwtModule } from '@nestjs/jwt';
import { config } from 'src/config';
import { UserPeersModule } from 'src/user-peers/userpeers.module';
import { UserpeersService } from 'src/user-peers/services/userpeers.service';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { Status } from 'src/typeorm/entities/Status';
import { Tag } from 'src/typeorm/entities/Tag';
import { Task } from 'src/typeorm/entities/Task';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { MailingService } from 'src/utils/mailing/mailing.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { Notification } from 'src/typeorm/entities/Notification';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { ProjectPeerInvite } from 'src/typeorm/entities/ProjectPeerInvite';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { Note } from 'src/typeorm/entities/Note';
import { Resource } from 'src/typeorm/entities/resource';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    JwtModule,
    MailingModule,
    ConfigModule,
    // NotificationsModule,
    forwardRef(() => NotificationsModule),
    // forwardRef(() => AuthModule),
    // forwardRef(() => UserPeersModule),
    TypeOrmModule.forFeature([
      User,
      Profile,
      Post,
      Project,
      Task,
      Tag,
      ProjectPeer,
      ProjectPeerInvite,
      ProjectComment,
      Status,
      UserPeer,
      UserPeerInvite,
      Notification,
      UserNotificationPreference,
      Note,
      Resource,
      ProjectActivity
    ]),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    MailingService,
    NotificationsService,
    ConfigService,
    NotificationsGateway,
  ],
  exports: [UsersService],
})
export class UsersModule {}
