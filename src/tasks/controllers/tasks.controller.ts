import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateTaskDto } from '../dtos/create-task.dto';
import { TasksService } from '../services/tasks.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

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
    @Body() updateTaskDto: CreateTaskDto,
  ) {
    return this.taskService.updateTask(id, updateTaskDto);
  }

  @Put(':id/update-priority')
  updateTaskPriority(
    @Param('id', ParseIntPipe) id: number,
    @Body() priorityStatus: any,
  ) {
    return this.taskService.updateTaskPriority(id, priorityStatus);
  }

  @Patch(':id/status')
  updateTaskStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: any,
    @Req() req: any,
  ) {
    return this.taskService.updateTaskStatus(id, payload, req.user);
  }

  @Post(':id')
  deleteTask(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.deleteTask(id);
  }


  @Get(':id/tasks')
  getProjectTasks(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.getProjectTasks(id);
  }


  @Post(':projectId/new-task')
  createProjectTask(
    @Param('projectId', ParseIntPipe) id: number,
    @Body() payload: any,
  ) {
    return this.taskService.createTask(id, payload);
  }
}