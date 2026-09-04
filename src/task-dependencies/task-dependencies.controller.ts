import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import {
  ApplyDependencyDatesDto,
  CreateTaskDependencyDto,
  PreviewDependencyDatesDto,
} from './task-dependencies.dto';
import { TaskDependenciesService } from './task-dependencies.service';

@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.TASK_DEPENDENCIES)
@Controller('tasks/:taskId/dependencies')
export class TaskDependenciesController {
  constructor(private readonly service: TaskDependenciesService) {}
  @Get() list(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.list(taskId, req.user, org);
  }
  @Get('warnings') warnings(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.warnings(taskId, req.user, org);
  }
  @Post() create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateTaskDependencyDto,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.create(taskId, dto.dependsOnTaskId, req.user, org);
  }
  @Post('date-preview') previewDates(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: PreviewDependencyDatesDto,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.previewDates(taskId, dto.dueDate, req.user, org);
  }
  @Post('date-apply') applyDates(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: ApplyDependencyDatesDto,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.applyDates(taskId, dto.previewToken, req.user, org);
  }
  @Delete(':dependencyId') remove(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('dependencyId') dependencyId: string,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.remove(taskId, dependencyId, req.user, org);
  }
}
