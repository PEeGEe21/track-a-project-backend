import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateTaskDto, UpdateTaskDto } from '../dtos/create-task.dto';
import { TasksService } from '../services/tasks.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { MulterFile } from 'src/types/multer.types';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { ProductivityTaskQueryDto } from '../dtos/productivity-task-query.dto';
import {
  CreateSavedTaskViewDto,
  UpdateSavedTaskViewDto,
} from '../dtos/saved-task-view.dto';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  ApiContractOperation,
  ApiOrganizationHeader,
  ApiStandardErrors,
} from 'src/common/openapi/api-contract.dto';
import {
  TaskListResponseDto,
  TaskOperationResponseDto,
  TaskResponseDto,
  ToggleTaskPriorityDto,
} from '../dtos/task-contract.dto';
import { UpdateTaskStatusDto } from '../dtos/update-task-status.dto';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
@ApiTags('Tasks')
@ApiBearerAuth()
@ApiOrganizationHeader()
@ApiStandardErrors({ forbidden: true })
export class TasksController {
  constructor(private taskService: TasksService) {}

  @Get('productivity')
  @ApiContractOperation('List productivity tasks', TaskListResponseDto)
  @UseGuards(OrganizationAccessGuard, CapabilityGuard)
  @RequireCapability(CapabilityKey.PERSONAL_PRODUCTIVITY_HUB)
  getProductivityTasks(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Query() query: ProductivityTaskQueryDto,
  ) {
    return this.taskService.findProductivityTasks(
      req.user,
      organizationId,
      query,
    );
  }

  @Get('productivity/views/saved')
  @ApiContractOperation('List saved task views', TaskOperationResponseDto)
  @UseGuards(OrganizationAccessGuard, CapabilityGuard)
  @RequireCapability(CapabilityKey.PERSONAL_PRODUCTIVITY_HUB)
  getSavedProductivityViews(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.getSavedTaskViews(req.user, organizationId);
  }

  @Post('productivity/views/saved')
  @ApiContractOperation(
    'Create a saved task view',
    TaskOperationResponseDto,
    201,
  )
  @UseGuards(OrganizationAccessGuard, CapabilityGuard)
  @RequireCapability(CapabilityKey.PERSONAL_PRODUCTIVITY_HUB)
  createSavedProductivityView(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Body() payload: CreateSavedTaskViewDto,
  ) {
    return this.taskService.createSavedTaskView(
      req.user,
      organizationId,
      payload,
    );
  }

  @Put('productivity/views/saved/:viewId')
  @ApiContractOperation('Update a saved task view', TaskOperationResponseDto)
  @UseGuards(OrganizationAccessGuard, CapabilityGuard)
  @RequireCapability(CapabilityKey.PERSONAL_PRODUCTIVITY_HUB)
  updateSavedProductivityView(
    @Param('viewId', ParseIntPipe) viewId: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Body() payload: UpdateSavedTaskViewDto,
  ) {
    return this.taskService.updateSavedTaskView(
      viewId,
      req.user,
      organizationId,
      payload,
    );
  }

  @Delete('productivity/views/saved/:viewId')
  @ApiContractOperation('Delete a saved task view', TaskOperationResponseDto)
  @UseGuards(OrganizationAccessGuard, CapabilityGuard)
  @RequireCapability(CapabilityKey.PERSONAL_PRODUCTIVITY_HUB)
  deleteSavedProductivityView(
    @Param('viewId', ParseIntPipe) viewId: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.deleteSavedTaskView(
      viewId,
      req.user,
      organizationId,
    );
  }

  @Get('/')
  @ApiContractOperation(
    'List tasks in the active organization',
    TaskListResponseDto,
  )
  @UseGuards(OrganizationAccessGuard)
  getTasks(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.findTasks(req.user, organizationId);
  }

  @Get(':id')
  @ApiContractOperation('Get a task', TaskResponseDto)
  @UseGuards(OrganizationAccessGuard)
  getTask(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.getTaskById(id, req.user, organizationId);
  }

  @Put(':id')
  @ApiContractOperation('Update a task', TaskResponseDto)
  @UseGuards(OrganizationAccessGuard)
  updateTaskById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTaskDto: UpdateTaskDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.updateTask(
      id,
      updateTaskDto,
      req.user,
      organizationId,
    );
  }

  @Put(':id/with-attachments')
  @ApiContractOperation('Update a task with attachments', TaskResponseDto)
  @ApiConsumes('multipart/form-data')
  @UseGuards(OrganizationAccessGuard)
  @UseInterceptors(FilesInterceptor('attachments'))
  updateTaskWithAttachments(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTaskDto: UpdateTaskDto,
    @UploadedFiles() files: MulterFile[],
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.updateTaskWithAttachments(
      id,
      updateTaskDto,
      files ?? [],
      req.user,
      organizationId,
    );
  }

  @Patch(':id/update-priority')
  @ApiContractOperation('Toggle task priority', TaskResponseDto)
  @UseGuards(OrganizationAccessGuard)
  updateTaskPriority(
    @Param('id', ParseIntPipe) id: number,
    @Body() priorityStatus: ToggleTaskPriorityDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.updateTaskPriority(
      id,
      priorityStatus,
      req.user,
      organizationId,
    );
  }

  @Patch(':id/status')
  @ApiContractOperation('Move and reorder a task', TaskResponseDto)
  @UseGuards(OrganizationAccessGuard)
  updateTaskStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateTaskStatusDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.updateTaskStatus(
      id,
      payload,
      req.user,
      organizationId,
    );
  }

  @Delete(':id')
  @ApiContractOperation('Delete a task', TaskOperationResponseDto)
  @UseGuards(OrganizationAccessGuard)
  deleteTask(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.deleteTask(id, req.user, organizationId);
  }

  @Get(':id/tasks')
  @ApiContractOperation('List tasks for a project', TaskListResponseDto)
  @UseGuards(OrganizationAccessGuard)
  getProjectTasks(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.getProjectTasks(id, req.user, organizationId);
  }

  @Post(':projectId')
  @ApiContractOperation('Create a task in a project', TaskResponseDto, 201)
  @UseGuards(OrganizationAccessGuard)
  createProjectTask(
    @Param('projectId', ParseIntPipe) id: number,
    @Body() payload: CreateTaskDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.createTask(id, payload, req.user, organizationId);
  }
}
