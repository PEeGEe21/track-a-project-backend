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

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private taskService: TasksService) {}
  @Get('/')
  getTasks() {
    return this.taskService.findTasks();
  }

  @Get(':id')
  getTask(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.getTaskById(id);
  }

  @Put(':id')
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
  deleteTask(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.deleteTask(id, req.user, organizationId);
  }

  @Get(':id/tasks')
  getProjectTasks(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.getProjectTasks(id);
  }

  @Post(':projectId')
  createProjectTask(
    @Param('projectId', ParseIntPipe) id: number,
    @Body() payload: any,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.taskService.createTask(id, payload, req.user, organizationId);
  }
}
