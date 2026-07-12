import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { Organization } from 'src/typeorm/entities/Organization';
import { OrganizationSettings } from 'src/typeorm/entities/OrganizationSettings';
import { EntitlementsService } from './entitlements.service';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsController } from './controllers/entitlements.controller';
import { CapabilityGuard } from './guards/capability.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationSettings,
      AuditLog,
      UserOrganization,
    ]),
  ],
  controllers: [EntitlementsController],
  providers: [EntitlementsService, OrganizationAccessGuard, CapabilityGuard],
  exports: [EntitlementsService, CapabilityGuard],
})
export class EntitlementsModule {}
