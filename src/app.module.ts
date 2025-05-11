import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Post } from './typeorm/entities/Post';
import { Profile } from './typeorm/entities/Profile';
import { User } from './typeorm/entities/User';
import { Project } from './typeorm/entities/Project';
import { Task } from './typeorm/entities/Task';
import { Tag } from './typeorm/entities/Tag';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import configuration from './config/configuration';
import { config } from './config';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectPeersModule } from './project-peers/project-peers.module';
import { ProjectPeer } from './typeorm/entities/ProjectPeer';
import { Status } from './typeorm/entities/Status';
import { StatusModule } from './status/status.module';
import { MailingModule } from './utils/mailing/mailing.module';
import { UserPeer } from './typeorm/entities/UserPeer';
import { UserPeersModule } from './user-peers/userpeers.module';
import { SeederService } from './seeder/seeder.service';
import { UserpeersService } from './user-peers/services/userpeers.service';
import { Category } from './typeorm/entities/Category';
import { CategoriesModule } from './categories/categories.module';
import { UserPeerInvite } from './typeorm/entities/UserPeerInvite';
import { NotificationsModule } from './notifications/notifications.module';
import { UserNotificationPreference } from './typeorm/entities/UserNotificationPreference';
import { Notification } from './typeorm/entities/Notification';
import { ProjectPeerInvite } from './typeorm/entities/ProjectPeerInvite';
import { ProjectComment } from './typeorm/entities/ProjectComment';
@Module({
  imports: [
    // ConfigModule.forRoot({
    //   isGlobal: true,
    //   load: [configuration],
    // }),
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      timezone: 'Z', // More explicit than 'Z'
      ssl: { rejectUnauthorized: false },
      entities: [
        User,
        Profile,
        Post,
        Project,
        Task,
        Tag,
        ProjectPeer,
        ProjectPeerInvite,
        Status,
        UserPeer,
        Category,
        UserPeerInvite,
        Notification,
        UserNotificationPreference,
        ProjectComment,
      ],
      synchronize: true,
      autoLoadEntities: true,
      // extra: {
      //   timezone: '+00:00',
      // },
      extra: {
        timezone: '+00:00',
        // connectionTimeZone: '+00:00',
      },
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
      Status,
      UserPeer,
      Category,
      UserPeerInvite,
      Notification,
      UserNotificationPreference,
      ProjectComment,
    ]),
    UsersModule,
    ProjectsModule,
    StatusModule,
    TasksModule,
    ProjectPeersModule,
    MailingModule,
    AuthModule,
    UserPeersModule,
    CategoriesModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeederService],
})
export class AppModule {}
