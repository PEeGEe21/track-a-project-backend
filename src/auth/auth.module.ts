import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
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
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeers';
import { ProjectPeersService } from 'src/project-peers/services/project-peers.service';
import { ProjectPeersModule } from 'src/project-peers/project-peers.module';
import { ProjectsService } from 'src/projects/services/projects.service';
import { ProjectsModule } from 'src/projects/projects.module';
import { Task } from 'src/typeorm/entities/Task';
import { TasksModule } from 'src/tasks/tasks.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ProjectPeersModule,
    TasksModule,
    ProjectsModule,
    JwtModule.register({
      secret: config.secret,
      signOptions: {
        expiresIn: 86400, // 1 week
      },
    }),
    TypeOrmModule.forFeature([User, Profile, Project, ProjectPeer, Task]),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, ProjectsService, ProjectPeersService]
})
export class AuthModule {}
