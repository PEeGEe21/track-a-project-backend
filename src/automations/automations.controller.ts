import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import { AutomationsService } from './automations.service';
import {
  CreateAutomationRuleDto,
  ListAutomationRulesQueryDto,
  UpdateAutomationDraftDto,
  DryRunAutomationDto,
  ListAutomationRunsQueryDto,
} from './dto/automation.dto';

@Controller('projects/:projectId/automations')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.RULE_BASED_AUTOMATION)
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  list(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListAutomationRulesQueryDto,
  ) {
    return this.automations.list(
      req.user,
      organizationId,
      projectId,
      Boolean(query.includeArchived),
    );
  }

  @Post()
  create(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateAutomationRuleDto,
  ) {
    return this.automations.create(req.user, organizationId, projectId, dto);
  }

  @Post(':ruleId/draft')
  createDraft(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.automations.createDraft(
      req.user,
      organizationId,
      projectId,
      ruleId,
    );
  }

  @Put(':ruleId/draft')
  updateDraft(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateAutomationDraftDto,
  ) {
    return this.automations.updateDraft(
      req.user,
      organizationId,
      projectId,
      ruleId,
      dto,
    );
  }

  @Post(':ruleId/publish')
  publish(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.automations.publish(
      req.user,
      organizationId,
      projectId,
      ruleId,
    );
  }

  @Post(':ruleId/dry-run')
  dryRun(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: DryRunAutomationDto,
  ) {
    return this.automations.dryRun(
      req.user,
      organizationId,
      projectId,
      ruleId,
      dto,
    );
  }

  @Get('history/runs')
  runs(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: ListAutomationRunsQueryDto,
  ) {
    return this.automations.listRuns(
      req.user,
      organizationId,
      projectId,
      query,
    );
  }

  @Get('history/runs/:runId')
  run(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    return this.automations.getRun(req.user, organizationId, projectId, runId);
  }

  @Get('watchers/:taskId')
  listWatchers(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.automations.listWatchers(
      req.user,
      organizationId,
      projectId,
      taskId,
    );
  }

  @Delete('watchers/:taskId/:userId')
  removeWatcher(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.automations.removeWatcher(
      req.user,
      organizationId,
      projectId,
      taskId,
      userId,
    );
  }

  @Post('history/runs/:runId/retry')
  retryRun(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    return this.automations.retryRun(
      req.user,
      organizationId,
      projectId,
      runId,
    );
  }

  @Get(':ruleId')
  get(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.automations.get(req.user, organizationId, projectId, ruleId);
  }

  @Post(':ruleId/enable')
  enable(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.automations.setEnabled(
      req.user,
      organizationId,
      projectId,
      ruleId,
      true,
    );
  }

  @Post(':ruleId/disable')
  disable(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.automations.setEnabled(
      req.user,
      organizationId,
      projectId,
      ruleId,
      false,
    );
  }

  @Post(':ruleId/archive')
  archive(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.automations.archive(
      req.user,
      organizationId,
      projectId,
      ruleId,
    );
  }
}
