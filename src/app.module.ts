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
import { ProjectPeer } from './typeorm/entities/ProjectPeers';
import { Status } from './typeorm/entities/Status';
import { StatusModule } from './status/status.module';

@Module({
  imports: [
    // ConfigModule.forRoot({
    //   isGlobal: true,
    //   load: [configuration],
    // }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root2',
      password: '123456',
      database: 'track_project_db2',
      entities: [User, Profile, Post, Project, Task, Tag, ProjectPeer, Status],
      synchronize: true,
    }),
    UsersModule,
    ProjectsModule,
    StatusModule,
    TasksModule,
    ProjectPeersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
