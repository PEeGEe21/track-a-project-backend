import { forwardRef, Module } from '@nestjs/common';
import { UserpeersService } from './services/userpeers.service';
import { UserpeersController } from './controllers/userpeers.controller';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Profile } from 'src/typeorm/entities/Profile';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { UsersModule } from 'src/users/users.module';
import { Status } from 'src/typeorm/entities/Status';
import { Tag } from 'src/typeorm/entities/Tag';
import { Task } from 'src/typeorm/entities/Task';
import { Post } from 'src/typeorm/entities/Post';
import { AuthModule } from 'src/auth/auth.module';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';

@Module({
  imports: [
    JwtModule,
    UsersModule,
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      User,
      Profile,
      Post,
      Project,
      Task,
      Tag,
      ProjectPeer,
      ProjectComment,
      Status,
      UserPeer,
      UserPeerInvite,
    ]),
  ],
  controllers: [UserpeersController],
  providers: [UserpeersService],
  exports: [UserpeersService],
})
export class UserPeersModule {}
