import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectsService } from './services/projects.service';
import { Task } from 'src/typeorm/entities/Task';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeers';
import { UsersModule } from 'src/users/users.module';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { MailingService } from 'src/utils/mailing/mailing.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, Post, Project, Task, ProjectPeer]),
    UsersModule,
    MailingModule,
    ConfigModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, MailingService, ConfigService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
