import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
import { StatusController } from './controllers/status.controller';
import { Task } from 'src/typeorm/entities/Task';
import { Status } from 'src/typeorm/entities/Status';
import { StatusService } from './services/status.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile, Post, Project, Task, Status])],
  controllers: [StatusController],
  providers: [StatusService],
  exports: [StatusService],
})
export class StatusModule {}