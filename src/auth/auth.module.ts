import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { config } from 'src/config';
import { JwtStrategy } from './guards/jwt.strategy';
import { LocalStrategy } from './guards/local.strategy';
import { ProjectsModule } from 'src/projects/projects.module';
import { Task } from 'src/typeorm/entities/Task';
import { TasksModule } from 'src/tasks/tasks.module';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { ConfigModule } from '@nestjs/config';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { Status } from 'src/typeorm/entities/Status';
import { Tag } from 'src/typeorm/entities/Tag';
import { Post } from 'src/typeorm/entities/Post';
import { UserPeersModule } from 'src/user-peers/userpeers.module';
import { CategoriesModule } from 'src/categories/categories.module';
import { Category } from 'src/typeorm/entities/Category';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { Notification } from 'src/typeorm/entities/Notification';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectPeerInvite } from 'src/typeorm/entities/ProjectPeerInvite';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { Resource } from 'src/typeorm/entities/Resource';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Organization } from 'src/typeorm/entities/Organization';
import { OrganizationInvitation } from 'src/typeorm/entities/OrganizationInvitation';
import { AuditLog } from 'src/typeorm/entities/AuditLog';

@Module({
  imports: [
    PassportModule,
    TasksModule,
    ProjectsModule,
    MailingModule,
    UserPeersModule,
    CategoriesModule,
    forwardRef(() => UsersModule),
    forwardRef(() => NotificationsModule),
    ProjectActivitiesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        secret: config.secret,
        signOptions: { expiresIn: config.expiresIn },
      }),
    }),
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
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
