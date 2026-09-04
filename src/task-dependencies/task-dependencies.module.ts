import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { Task } from 'src/typeorm/entities/Task';
import { TaskDependency } from 'src/typeorm/entities/TaskDependency';
import { TaskDependenciesController } from './task-dependencies.controller';
import { TaskDependenciesService } from './task-dependencies.service';
import { User } from 'src/typeorm/entities/User';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskDependency, User]),
    AuthorizationModule,
    EntitlementsModule,
    ProjectActivitiesModule,
  ],
  controllers: [TaskDependenciesController],
  providers: [TaskDependenciesService],
  exports: [TaskDependenciesService],
})
export class TaskDependenciesModule {}
