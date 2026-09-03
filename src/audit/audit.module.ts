import { Global, Module } from '@nestjs/common';
import { AuditPayloadSanitizer } from './audit-payload-sanitizer';
import { AuditWriterService } from './audit-writer.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  AuditRequestContextInterceptor,
  AuditRequestContextService,
} from './audit-request-context.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { AuditReaderService } from './audit-reader.service';
import { AuditController } from './audit.controller';
import { AuditControlsService } from './audit-controls.service';
import { AuditSupportController } from './audit-support.controller';
import { AuditExport } from 'src/typeorm/entities/AuditExport';
import { AuditRetentionPolicy } from 'src/typeorm/entities/AuditRetentionPolicy';
import { AuditPurgeRun } from 'src/typeorm/entities/AuditPurgeRun';
import { SuperAdminGuard } from 'src/common/guards/super-admin.guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, UserOrganization, ProjectPeer, AuditExport, AuditRetentionPolicy, AuditPurgeRun]),
    EntitlementsModule,
  ],
  controllers: [AuditController, AuditSupportController],
  providers: [
    AuditPayloadSanitizer,
    AuditWriterService,
    AuditRequestContextService,
    AuditRequestContextInterceptor,
    AuditReaderService,
    AuditControlsService,
    OrganizationAccessGuard,
    SuperAdminGuard,
    {
      provide: APP_INTERCEPTOR,
      useExisting: AuditRequestContextInterceptor,
    },
  ],
  exports: [
    AuditPayloadSanitizer,
    AuditWriterService,
    AuditRequestContextService,
  ],
})
export class AuditModule {}
