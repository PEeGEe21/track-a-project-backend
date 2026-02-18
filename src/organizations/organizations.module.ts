import { forwardRef, Module } from '@nestjs/common';
import { OrganizationsService } from './services/organizations.service';
import { OrganizationsController } from './controllers/organizations.controller';
import { UsersService } from 'src/users/services/users.service';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { Status } from 'src/typeorm/entities/Status';
import { Tag } from 'src/typeorm/entities/Tag';
import { Task } from 'src/typeorm/entities/Task';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { Notification } from 'src/typeorm/entities/Notification';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ProjectPeerInvite } from 'src/typeorm/entities/ProjectPeerInvite';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { Note } from 'src/typeorm/entities/Note';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { AuthModule } from 'src/auth/auth.module';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Organization } from 'src/typeorm/entities/Organization';
import { GlobalMenu } from 'src/typeorm/entities/GlobalMenu';
import { OrganizationMenu } from 'src/typeorm/entities/OrganizationMenu';
import { MessageReadReceipt } from 'src/typeorm/entities/MessageReadReceipt';
import { MessageReaction } from 'src/typeorm/entities/MessageReaction';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { User } from 'src/typeorm/entities/User';
import { Profile } from 'src/typeorm/entities/Profile';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Post } from 'src/typeorm/entities/Post';
import { OrganizationInvitation } from 'src/typeorm/entities/OrganizationInvitation';
import { BillingModule } from 'src/billing/billing.module';
import { Subscription } from 'src/typeorm/entities/Subscription';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    JwtModule,
    MailingModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    forwardRef(() => BillingModule),
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
      MessageReaction,
      MessageReadReceipt,
      UserOrganization,
      OrganizationMenu,
      GlobalMenu,
      Organization,
      OrganizationInvitation,
      Subscription,
    ]),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, UsersService],
})
export class OrganizationsModule {}
