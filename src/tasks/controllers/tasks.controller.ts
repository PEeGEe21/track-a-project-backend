import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CreateTaskDto } from '../dtos/create-task.dto';
import { TasksService } from '../services/tasks.service';

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