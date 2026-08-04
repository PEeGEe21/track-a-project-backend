import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { ProjectActivitiesModule } from 'src/project-activities/project-activities.module';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { CustomFieldOption } from 'src/typeorm/entities/CustomFieldOption';
import { TaskCustomFieldValue } from 'src/typeorm/entities/TaskCustomFieldValue';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import {
  CustomFieldsController,
  TaskCustomFieldsController,
} from './custom-fields.controller';
import { CustomFieldsService } from './custom-fields.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomFieldDefinition,
      CustomFieldOption,
      TaskCustomFieldValue,
      UserOrganization,
    ]),
    AuthorizationModule,
    EntitlementsModule,
    ProjectActivitiesModule,
  ],
  controllers: [CustomFieldsController, TaskCustomFieldsController],
  providers: [CustomFieldsService, OrganizationAccessGuard],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
