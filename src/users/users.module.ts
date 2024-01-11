import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../typeorm/entities/Post';
import { Profile } from '../typeorm/entities/Profile';
import { User } from '../typeorm/entities/User';
import { UsersController } from './controllers//users.controller';
import { UsersService } from './services/users.service';
import { Project } from 'src/typeorm/entities/Project';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile, Post, Project])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {} 
