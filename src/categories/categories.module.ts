import { forwardRef, Module } from '@nestjs/common';
import { CategoriesService } from './services/categories.service';
import { CategoriesController } from './controllers/categories.controller';
import { UsersService } from 'src/users/services/users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/typeorm/entities/User';
import { Profile } from 'src/typeorm/entities/Profile';
import { Project } from 'src/typeorm/entities/Project';
import { Task } from 'src/typeorm/entities/Task';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Category } from 'src/typeorm/entities/Category';
import { UsersModule } from 'src/users/users.module';
import { Post } from 'src/typeorm/entities/Post';
import { ProjectsModule } from 'src/projects/projects.module';
import { ProjectsService } from 'src/projects/services/projects.service';
import { ProjectsGateway } from 'src/projects/projects.gateway';
import { MailingModule } from 'src/utils/mailing/mailing.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

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
      Project,
      ProjectPeer,
    ]),
    UsersModule,
    MailingModule,
    NotificationsModule,

    forwardRef(() => ProjectsModule), // Use forwardRef for circular dependencies
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
