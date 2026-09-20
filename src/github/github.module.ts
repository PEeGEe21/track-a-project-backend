import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { GithubConnection } from 'src/typeorm/entities/GithubConnection';
import { GithubDelivery } from 'src/typeorm/entities/GithubDelivery';
import { GithubArtifact } from 'src/typeorm/entities/GithubArtifact';
import { GithubTaskLink } from 'src/typeorm/entities/GithubTaskLink';
import { GithubLinkDiagnostic } from 'src/typeorm/entities/GithubLinkDiagnostic';
import { Task } from 'src/typeorm/entities/Task';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';
import { GithubSupportController } from './github-support.controller';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GithubConnection,
      GithubDelivery,
      GithubArtifact,
      GithubTaskLink,
      GithubLinkDiagnostic,
      Task,
      UserOrganization,
    ]),
    AuthorizationModule,
    EntitlementsModule,
    NotificationsModule,
  ],
  controllers: [GithubController, GithubSupportController],
  providers: [GithubService, OrganizationAccessGuard],
})
export class GithubModule {}
