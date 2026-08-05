import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { Milestone } from 'src/typeorm/entities/Milestone';
import { MilestoneTask } from 'src/typeorm/entities/MilestoneTask';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Task } from 'src/typeorm/entities/Task';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Milestone,
      MilestoneTask,
      Task,
      ProjectPeer,
      UserOrganization,
    ]),
    AuthorizationModule,
    EntitlementsModule,
    ProjectActivitiesModule,
  ],
  controllers: [MilestonesController],
  providers: [MilestonesService, OrganizationAccessGuard],
  exports: [MilestonesService],
})
export class MilestonesModule {}
