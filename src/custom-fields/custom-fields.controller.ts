import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { CustomFieldsService } from './custom-fields.service';
import {
  CreateCustomFieldDefinitionDto,
  ReorderCustomFieldsDto,
  UpdateCustomFieldDefinitionDto,
} from './dto/custom-field-definition.dto';
import { SetTaskCustomFieldValuesDto } from './dto/task-custom-field-values.dto';

@Controller('projects/:projectId/custom-fields')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.CUSTOM_FIELDS)
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  @Get()
  list(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('includeArchived', new ParseBoolPipe({ optional: true }))
    includeArchived = false,
  ) {
    return this.service.list(req.user, organizationId, projectId, includeArchived);
  }

  @Post()
  create(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateCustomFieldDefinitionDto,
  ) {
    return this.service.create(req.user, organizationId, projectId, dto);
  }

  @Patch(':fieldId')
  update(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateCustomFieldDefinitionDto,
  ) {
    return this.service.update(req.user, organizationId, projectId, fieldId, dto);
  }

  @Put('order')
  reorder(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: ReorderCustomFieldsDto,
  ) {
    return this.service.reorder(req.user, organizationId, projectId, dto);
  }

  @Post(':fieldId/archive')
  archive(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('fieldId') fieldId: string,
  ) {
    return this.service.archive(req.user, organizationId, projectId, fieldId);
  }
}

@Controller('tasks/:taskId/custom-fields')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.CUSTOM_FIELDS)
export class TaskCustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  @Get()
  getValues(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.service.getTaskValues(req.user, organizationId, taskId);
  }

  @Put()
  setValues(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: SetTaskCustomFieldValuesDto,
  ) {
    return this.service.setTaskValues(
      req.user,
      organizationId,
      taskId,
      dto.values,
    );
  }
}
