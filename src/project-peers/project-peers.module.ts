import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeersController } from './controllers/project-peers.controller';
import { ProjectPeersService } from './services/project-peers.service';
import { Task } from 'src/typeorm/entities/Task';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, Post, Project, Task, ProjectPeer]),
  ],
  controllers: [ProjectPeersController],
  providers: [ProjectPeersService],
  exports: [ProjectPeersService],
})
export class ProjectPeersModule {}
