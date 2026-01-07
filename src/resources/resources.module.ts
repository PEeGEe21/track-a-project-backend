import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourcesService } from './services/resources.service';
import { ResourcesController } from './controllers/resources.controller';
import { Resource } from '../typeorm/entities/resource';
import { Project } from '../typeorm/entities/Project';
import { Task } from '../typeorm/entities/Task';
import { User } from '../typeorm/entities/User';
import { FirebaseStorageService } from '../firebase/firebase-storage.service';
import { SimplePreviewService } from '../services/simple-preview.service';
import { UsersService } from 'src/users/services/users.service';
import { Profile } from 'src/typeorm/entities/Profile';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { JwtModule } from '@nestjs/jwt';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { Post } from 'src/typeorm/entities/Post';
import { Tag } from 'src/typeorm/entities/Tag';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectPeerInvite } from 'src/typeorm/entities/ProjectPeerInvite';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { Status } from 'src/typeorm/entities/Status';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { Note } from 'src/typeorm/entities/Note';
import { Notification } from 'src/typeorm/entities/Notification';
import { SupabaseStorageService } from 'src/supabase/supabase-storage.service';
import { ConfigModule } from '@nestjs/config';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    JwtModule,
    MailingModule,
    ProjectActivitiesModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    ConfigModule,
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
      ProjectActivity,
      UserOrganization
    ]),
  ],
  controllers: [ResourcesController],
  providers: [
    ResourcesService,
    UsersService,
    FirebaseStorageService,
    SupabaseStorageService,
    SimplePreviewService,
  ],
  exports: [ResourcesService, FirebaseStorageService, SupabaseStorageService, SimplePreviewService],
})
export class ResourcesModule {}
