import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { CustomWorkflowsService } from './custom-workflows.service';
import {
  PublishWorkflowDto,
  UpdateWorkflowDraftDto,
} from './dto/custom-workflow.dto';

@Controller('projects/:projectId/workflow')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.CUSTOM_WORKFLOWS)
export class CustomWorkflowsController {
  constructor(private readonly workflows: CustomWorkflowsService) {}

  @Get()
  get(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.workflows.get(req.user, organizationId, projectId);
  }

  @Post('draft')
  createDraft(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.workflows.createDraft(req.user, organizationId, projectId);
  }

  @Put('draft')
  updateDraft(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: UpdateWorkflowDraftDto,
  ) {
    return this.workflows.updateDraft(req.user, organizationId, projectId, dto);
  }

  @Post('publish')
  publish(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: PublishWorkflowDto,
  ) {
    return this.workflows.publish(req.user, organizationId, projectId, dto);
  }

  @Post('reset')
  reset(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.workflows.resetToDefault(req.user, organizationId, projectId);
  }
}

@Controller('tasks/:taskId/transition-history')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.CUSTOM_WORKFLOWS)
export class TaskTransitionHistoryController {
  constructor(private readonly workflows: CustomWorkflowsService) {}

  @Get()
  list(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.workflows.getTaskHistory(req.user, organizationId, taskId);
  }

  @Get('allowed')
  allowed(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.workflows.getAllowedTransitions(
      req.user,
      organizationId,
      taskId,
    );
  }
}
