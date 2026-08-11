import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionKeyService } from './services/ingestion-key.service';
import { IngestApiKey } from 'src/typeorm/entities/IngestApiKey';
import { IngestionApiKeyGuard } from './guards/ingestion-api-key.guard';
import { IngestionController } from './controllers/ingestion.controller';
import { IngestionService } from './services/ingestion.service';
import { Project } from 'src/typeorm/entities/Project';
import { Task } from 'src/typeorm/entities/Task';
import { Status } from 'src/typeorm/entities/Status';
import { IngestedEvent } from 'src/typeorm/entities/IngestedEvent';
import { User } from 'src/typeorm/entities/User';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';
import { IngestionRateLimitGuard } from './guards/ingestion-rate-limit.guard';
import { IngestionBodySizeGuard } from './guards/ingestion-body-size.guard';
import { ProjectIngestionSettings } from 'src/typeorm/entities/ProjectIngestionSettings';
import { ProjectsModule } from 'src/projects/projects.module';
import { CustomWorkflowsModule } from 'src/custom-workflows/custom-workflows.module';
import { IntakeEvent } from 'src/typeorm/entities/IntakeEvent';
import { IntakeEventAttempt } from 'src/typeorm/entities/IntakeEventAttempt';
import { NormalizedIntakeService } from './services/normalized-intake.service';
import { CustomFieldsModule } from 'src/custom-fields/custom-fields.module';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { IntakeOperationsController } from './controllers/intake-operations.controller';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { IntakeImportBatch } from 'src/typeorm/entities/IntakeImportBatch';
import { IntakeImportRow } from 'src/typeorm/entities/IntakeImportRow';
import { IntakeImportsController } from './controllers/intake-imports.controller';
import { IntakeImportService } from './services/intake-import.service';
import { IntakeWebhookSource } from 'src/typeorm/entities/IntakeWebhookSource';
import { IntakeWebhooksController } from './controllers/intake-webhooks.controller';
import { PublicIntakeWebhooksController } from './controllers/public-intake-webhooks.controller';
import { IntakeWebhookService } from './services/intake-webhook.service';
import { IntakeEmailAddress } from 'src/typeorm/entities/IntakeEmailAddress';
import { IntakeEmailAttachment } from 'src/typeorm/entities/IntakeEmailAttachment';
import { IntakeEmailController } from './controllers/intake-email.controller';
import { PublicIntakeEmailController } from './controllers/public-intake-email.controller';
import { IntakeEmailService } from './services/intake-email.service';
import { StorageModule } from 'src/storage/storage.module';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IngestApiKey,
      Project,
      Task,
      Status,
      IngestedEvent,
      User,
      ProjectIngestionSettings,
      IntakeEvent,
      IntakeEventAttempt,
      IntakeImportBatch,
      IntakeImportRow,
      IntakeWebhookSource,
      IntakeEmailAddress,
      IntakeEmailAttachment,
      UserOrganization,
    ]),
    ProjectActivitiesModule,
    forwardRef(() => ProjectsModule),
    CustomWorkflowsModule,
    CustomFieldsModule,
    AuthorizationModule,
    EntitlementsModule,
    StorageModule,
  ],
  controllers: [
    IngestionController,
    IntakeOperationsController,
    IntakeImportsController,
    IntakeWebhooksController,
    PublicIntakeWebhooksController,
    IntakeEmailController,
    PublicIntakeEmailController,
  ],
  providers: [
    IngestionKeyService,
    IngestionApiKeyGuard,
    IngestionRateLimitGuard,
    IngestionBodySizeGuard,
    IngestionService,
    NormalizedIntakeService,
    IntakeImportService,
    IntakeWebhookService,
    IntakeEmailService,
    OrganizationAccessGuard,
  ],
  exports: [IngestionKeyService, IngestionApiKeyGuard],
})
export class IngestionModule {}
