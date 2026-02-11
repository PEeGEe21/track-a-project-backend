import { forwardRef, Module } from '@nestjs/common';
import { NotesService } from './services/notes.service';
import { NotesController } from './controllers/notes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Task } from 'src/typeorm/entities/Task';
import { Note } from 'src/typeorm/entities/Note';
import { UsersService } from 'src/users/services/users.service';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { ProjectPeerInvite } from 'src/typeorm/entities/ProjectPeerInvite';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { Status } from 'src/typeorm/entities/Status';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Tag } from 'src/typeorm/entities/Tag';
import { Project } from 'src/typeorm/entities/Project';
import { Post } from 'src/typeorm/entities/Post';
import { Profile } from 'src/typeorm/entities/Profile';
import { Notification } from 'src/typeorm/entities/Notification';
import { AuthModule } from 'src/auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Organization } from 'src/typeorm/entities/Organization';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),

    JwtModule,
    // UsersModule,
    MailingModule,
    forwardRef(() => AuthModule),
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
      Note,
      ProjectActivity,
      UserOrganization,
      Organization
    ]),
  ],
  controllers: [NotesController],
  providers: [
    NotesService,
    UsersService,
    NotificationsService,
    NotificationsGateway,
  ],
  exports: [NotesService],
})
export class NotesModule {}
