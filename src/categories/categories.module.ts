import { Module } from '@nestjs/common';
import { CategoriesService } from './services/categories.service';
import { CategoriesController } from './controllers/categories.controller';
import { UsersService } from 'src/users/services/users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Profile } from 'src/typeorm/entities/Profile';
import { Project } from 'src/typeorm/entities/Project';
import { Task } from 'src/typeorm/entities/Task';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeers';
import { Category } from 'src/typeorm/entities/Category';
import { UsersModule } from 'src/users/users.module';
import { Post } from 'src/typeorm/entities/Post';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Post,
      Profile,
      Project,
      Task,
      ProjectPeer,
      Category,
    ]),
    UsersModule,
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
