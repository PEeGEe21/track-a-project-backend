import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
import { TasksController } from './controllers/tasks.controller';
import { TasksService } from './services/tasks.service';
import { Task } from 'src/typeorm/entities/Task';
import { Status } from 'src/typeorm/entities/Status';
import { Note } from 'src/typeorm/entities/Note';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { Notification } from 'src/typeorm/entities/Notification';
import { UsersModule } from 'src/users/users.module';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Post,
      Project,
      Task,
      Status,
      Note,
      Notification,
      UserNotificationPreference
    ]),
    forwardRef(() => UsersModule),
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, NotificationsService, NotificationsGateway],
  exports: [TasksService],
})
export class TasksModule {}
