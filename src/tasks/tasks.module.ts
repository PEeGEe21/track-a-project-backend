import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
import { TasksController } from './controllers/tasks.controller';
import { TasksService } from './services/tasks.service';
import { Task } from 'src/typeorm/entities/Task';
import { Status } from 'src/typeorm/entities/Status';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile, Post, Project, Task, Status])],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}