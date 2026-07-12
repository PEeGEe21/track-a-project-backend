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

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private taskService: TasksService) {}
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
