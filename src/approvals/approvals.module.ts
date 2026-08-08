import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ApprovalRequest } from 'src/typeorm/entities/ApprovalRequest';
import { ApprovalResponse } from 'src/typeorm/entities/ApprovalResponse';
import { ApprovalReviewer } from 'src/typeorm/entities/ApprovalReviewer';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { Document } from 'src/typeorm/entities/Document';
import { Milestone } from 'src/typeorm/entities/Milestone';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Task } from 'src/typeorm/entities/Task';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalRequest,
      ApprovalReviewer,
      ApprovalResponse,
      AuditLog,
      Task,
      Document,
      Milestone,
      Project,
      ProjectPeer,
      UserOrganization,
    ]),
    AuthorizationModule,
    EntitlementsModule,
    NotificationsModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, OrganizationAccessGuard],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
