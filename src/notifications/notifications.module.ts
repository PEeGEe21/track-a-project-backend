import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Profile } from 'src/typeorm/entities/Profile';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { UsersModule } from 'src/users/users.module';
import { Status } from 'src/typeorm/entities/Status';
import { Tag } from 'src/typeorm/entities/Tag';
import { Task } from 'src/typeorm/entities/Task';
import { Post } from 'src/typeorm/entities/Post';
import { AuthModule } from 'src/auth/auth.module';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { NotificationsService } from './services/notifications.service';
import { NotificationsController } from './controllers/notifications.controller';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { Notification } from 'src/typeorm/entities/Notification';
import { NotificationsGateway } from './notifications.gateway';
import { UsersService } from 'src/users/services/users.service';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { ProjectPeerInvite } from 'src/typeorm/entities/ProjectPeerInvite';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { Note } from 'src/typeorm/entities/Note';

@Module({
  imports: [
    // UsersModule,
    MailingModule,
    // forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    TypeOrmModule.forFeature([
      User,
      Profile,
      Post,
      Project,
      Task,
      Tag,
      ProjectPeer,
      Status,
      UserPeer,
      UserPeerInvite,
      ProjectPeerInvite,
      ProjectComment,
      Notification,
      UserNotificationPreference,
      Note
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
