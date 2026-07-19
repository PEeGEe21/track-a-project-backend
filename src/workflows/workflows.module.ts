import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { Status } from 'src/typeorm/entities/Status';
import { Project } from 'src/typeorm/entities/Project';
import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Whiteboard } from 'src/typeorm/entities/Whiteboard';
import { WorkConversion } from 'src/typeorm/entities/WorkConversion';
import { WorkflowStep } from 'src/typeorm/entities/WorkflowStep';
import { WorkflowTemplate } from 'src/typeorm/entities/WorkflowTemplate';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Whiteboard,
      Project,
      Task,
      Status,
      User,
      UserOrganization,
      ProjectPeer,
      WorkflowTemplate,
      WorkflowStep,
      WorkConversion,
    ]),
    AuthorizationModule,
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
})
export class WorkflowsModule {}
