import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';
import { CustomFieldsModule } from 'src/custom-fields/custom-fields.module';
import { StorageModule } from 'src/storage/storage.module';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { RequestForm } from 'src/typeorm/entities/RequestForm';
import { RequestFormField } from 'src/typeorm/entities/RequestFormField';
import { RequestFormSubmission } from 'src/typeorm/entities/RequestFormSubmission';
import { RequestFormSubmissionAttachment } from 'src/typeorm/entities/RequestFormSubmissionAttachment';
import { RequestFormVersion } from 'src/typeorm/entities/RequestFormVersion';
import { Status } from 'src/typeorm/entities/Status';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { RequestFormsController } from './request-forms.controller';
import { PublicRequestFormsController } from './public-request-forms.controller';
import { RequestFormsService } from './request-forms.service';
import { AutomationsModule } from 'src/automations/automations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RequestForm,
      RequestFormVersion,
      RequestFormField,
      RequestFormSubmission,
      RequestFormSubmissionAttachment,
      CustomFieldDefinition,
      Status,
      UserOrganization,
    ]),
    AuthorizationModule,
    EntitlementsModule,
    ProjectActivitiesModule,
    CustomFieldsModule,
    StorageModule,
    AutomationsModule,
  ],
  controllers: [RequestFormsController, PublicRequestFormsController],
  providers: [RequestFormsService, OrganizationAccessGuard],
  exports: [RequestFormsService],
})
export class RequestFormsModule {}
