import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import {
  CreateMilestoneDto,
  MilestoneListQueryDto,
  ReplaceMilestoneTasksDto,
  TransitionMilestoneDto,
  UpdateMilestoneDto,
} from './dto/milestone.dto';
import { MilestonesService } from './milestones.service';

@Controller('projects/:projectId/milestones')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.MILESTONES)
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get()
  list(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: MilestoneListQueryDto,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.milestones.list(
      req.user,
      organizationId,
      projectId,
      query,
      includeArchived === 'true',
    );
  }

  @Get(':milestoneId')
  get(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    return this.milestones.get(
      req.user,
      organizationId,
      projectId,
      milestoneId,
    );
  }

  @Post()
  create(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.milestones.create(
      req.user,
      organizationId,
      projectId,
      dto,
    );
  }

  @Patch(':milestoneId')
  update(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.milestones.update(
      req.user,
      organizationId,
      projectId,
      milestoneId,
      dto,
    );
  }

  @Put(':milestoneId/tasks')
  replaceTasks(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: ReplaceMilestoneTasksDto,
  ) {
    return this.milestones.replaceTasks(
      req.user,
      organizationId,
      projectId,
      milestoneId,
      dto,
    );
  }

  @Post(':milestoneId/archive')
  archive(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    return this.milestones.archive(
      req.user,
      organizationId,
      projectId,
      milestoneId,
    );
  }

  @Post(':milestoneId/status')
  transition(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: TransitionMilestoneDto,
  ) {
    return this.milestones.transition(
      req.user,
      organizationId,
      projectId,
      milestoneId,
      dto,
    );
  }
}
