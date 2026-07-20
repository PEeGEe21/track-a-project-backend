import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { UserProjectSidebarPin } from 'src/typeorm/entities/UserProjectSidebarPin';
import { SidebarProjectsController } from './sidebar-projects.controller';
import { SidebarProjectsService } from './sidebar-projects.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProjectSidebarPin, UserOrganization]),
    AuthorizationModule,
  ],
  controllers: [SidebarProjectsController],
  providers: [SidebarProjectsService, OrganizationAccessGuard],
})
export class SidebarProjectsModule {}
