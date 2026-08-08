import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { Project } from 'src/typeorm/entities/Project';
import { ReusableTemplate } from 'src/typeorm/entities/ReusableTemplate';
import { ReusableTemplateVersion } from 'src/typeorm/entities/ReusableTemplateVersion';
import { Status } from 'src/typeorm/entities/Status';
import { Task } from 'src/typeorm/entities/Task';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReusableTemplate,
      ReusableTemplateVersion,
      Project,
      Status,
      Task,
      UserOrganization,
    ]),
    AuthorizationModule,
    EntitlementsModule,
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService, OrganizationAccessGuard],
  exports: [TemplatesService],
})
export class TemplatesModule {}
