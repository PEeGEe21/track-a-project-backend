import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { Notification } from 'src/typeorm/entities/Notification';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Project } from 'src/typeorm/entities/Project';
import { Task } from 'src/typeorm/entities/Task';
import { TaskComment } from 'src/typeorm/entities/TaskComment';
import { TaskCommentEdit } from 'src/typeorm/entities/TaskCommentEdit';
import { TaskCommentReaction } from 'src/typeorm/entities/TaskCommentReaction';
import { User } from 'src/typeorm/entities/User';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { TaskDiscussionsController } from './task-discussions.controller';
import { TaskDiscussionsService } from './task-discussions.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskComment,
      TaskCommentReaction,
      TaskCommentEdit,
      Task,
      User,
      ProjectPeer,
      Project,
      Notification,
      UserOrganization,
    ]),
    AuthorizationModule,
  ],
  controllers: [TaskDiscussionsController],
  providers: [TaskDiscussionsService],
})
export class TaskDiscussionsModule {}
