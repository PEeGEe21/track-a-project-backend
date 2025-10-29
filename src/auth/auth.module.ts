import { Module } from '@nestjs/common';
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
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectPeersService } from 'src/project-peers/services/project-peers.service';
import { ProjectPeersModule } from 'src/project-peers/project-peers.module';
import { ProjectsService } from 'src/projects/services/projects.service';
import { ProjectsModule } from 'src/projects/projects.module';
import { Task } from 'src/typeorm/entities/Task';
import { TasksModule } from 'src/tasks/tasks.module';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/services/users.service';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { Status } from 'src/typeorm/entities/Status';
import { Tag } from 'src/typeorm/entities/Tag';
import { Post } from 'src/typeorm/entities/Post';
import { UserpeersService } from 'src/user-peers/services/userpeers.service';
import { UserPeersModule } from 'src/user-peers/userpeers.module';
import { CategoriesModule } from 'src/categories/categories.module';
import { Category } from 'src/typeorm/entities/Category';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { Notification } from 'src/typeorm/entities/Notification';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { ProjectPeerInvite } from 'src/typeorm/entities/ProjectPeerInvite';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { Resource } from 'src/typeorm/entities/resource';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ProjectPeersModule,
    TasksModule,
    ProjectsModule,
    MailingModule,
    UserPeersModule,
    CategoriesModule,
    NotificationsModule,
    ProjectActivitiesModule,
    // JwtModule.register({
    //   secret: config.secret,
    //   signOptions: {
    //     expiresIn: config.expiresIn, // 1 week
    //   },
    // }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
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
      ProjectActivity
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    ProjectsService,
    ProjectPeersService,
    ConfigService,
    UsersService,
    NotificationsService,
    NotificationsGateway,
  ],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
