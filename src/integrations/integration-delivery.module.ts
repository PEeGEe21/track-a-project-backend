import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { IntegrationDelivery } from 'src/typeorm/entities/IntegrationDelivery';
import { IntegrationDeliveryAttempt } from 'src/typeorm/entities/IntegrationDeliveryAttempt';
import { IntegrationEndpoint } from 'src/typeorm/entities/IntegrationEndpoint';
import { IntegrationPublisherCheckpoint } from 'src/typeorm/entities/IntegrationPublisherCheckpoint';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { IntegrationDeliveryController } from './integration-delivery.controller';
import { IntegrationDeliveryService } from './integration-delivery.service';
import { IntegrationDeliverySupportController } from './integration-delivery-support.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationEndpoint,
      IntegrationPublisherCheckpoint,
      IntegrationDelivery,
      IntegrationDeliveryAttempt,
      AuditLog,
      UserOrganization,
      Project,
      ProjectPeer,
    ]),
    EntitlementsModule,
  ],
  controllers: [
    IntegrationDeliveryController,
    IntegrationDeliverySupportController,
  ],
  providers: [IntegrationDeliveryService, OrganizationAccessGuard],
})
export class IntegrationDeliveryModule {}
