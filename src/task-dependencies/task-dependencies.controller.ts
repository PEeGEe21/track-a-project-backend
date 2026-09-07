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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApiContractOperation,
  ApiObjectResponseDto,
  ApiOrganizationHeader,
  ApiStandardErrors,
} from 'src/common/openapi/api-contract.dto';
import {
  DependencyScheduleResponseDto,
  TaskDependencyListResponseDto,
  TaskDependencyResponseDto,
} from './task-dependency-contract.dto';

@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.TASK_DEPENDENCIES)
@Controller('tasks/:taskId/dependencies')
@ApiTags('Task dependencies')
@ApiBearerAuth()
@ApiOrganizationHeader()
@ApiStandardErrors({ forbidden: true })
export class TaskDependenciesController {
  constructor(private readonly service: TaskDependenciesService) {}
  @Get()
  @ApiContractOperation('List task dependencies', TaskDependencyListResponseDto)
  list(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.list(taskId, req.user, org);
  }
  @Get('warnings')
  @ApiContractOperation('Get dependency warnings', ApiObjectResponseDto)
  warnings(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.warnings(taskId, req.user, org);
  }
  @Post()
  @ApiContractOperation(
    'Create a task dependency',
    TaskDependencyResponseDto,
    201,
  )
  create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateTaskDependencyDto,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.create(taskId, dto.dependsOnTaskId, req.user, org);
  }
  @Post('date-preview')
  @ApiContractOperation(
    'Preview dependency date changes',
    DependencyScheduleResponseDto,
    201,
  )
  previewDates(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: PreviewDependencyDatesDto,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.previewDates(taskId, dto.dueDate, req.user, org);
  }
  @Post('date-apply')
  @ApiContractOperation(
    'Apply dependency date changes',
    DependencyScheduleResponseDto,
    201,
  )
  applyDates(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: ApplyDependencyDatesDto,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.applyDates(taskId, dto.previewToken, req.user, org);
  }
  @Delete(':dependencyId')
  @ApiContractOperation('Delete a task dependency', ApiObjectResponseDto)
  remove(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('dependencyId') dependencyId: string,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.remove(taskId, dependencyId, req.user, org);
  }
}
