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

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private taskService: TasksService) {}

  @Get('productivity')
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
  @UseGuards(OrganizationAccessGuard, CapabilityGuard)
  @RequireCapability(CapabilityKey.PERSONAL_PRODUCTIVITY_HUB)
  getSavedProductivityViews(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.getSavedTaskViews(req.user, organizationId);
  }

  @Post('productivity/views/saved')
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
  @UseGuards(OrganizationAccessGuard)
  getTasks(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.findTasks(req.user, organizationId);
  }

  @Get(':id')
  @UseGuards(OrganizationAccessGuard)
  getTask(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.getTaskById(id, req.user, organizationId);
  }

  @Put(':id')
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
  @UseGuards(OrganizationAccessGuard)
  updateTaskPriority(
    @Param('id', ParseIntPipe) id: number,
    @Body() priorityStatus: any,
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
  @UseGuards(OrganizationAccessGuard)
  updateTaskStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: any,
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
  @UseGuards(OrganizationAccessGuard)
  deleteTask(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.deleteTask(id, req.user, organizationId);
  }

  @Get(':id/tasks')
  @UseGuards(OrganizationAccessGuard)
  getProjectTasks(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.getProjectTasks(id, req.user, organizationId);
  }

  @Post(':projectId')
  @UseGuards(OrganizationAccessGuard)
  createProjectTask(
    @Param('projectId', ParseIntPipe) id: number,
    @Body() payload: any,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.createTask(id, payload, req.user, organizationId);
  }
}
