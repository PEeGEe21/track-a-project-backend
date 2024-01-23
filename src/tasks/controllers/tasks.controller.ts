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
  getProject(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.getTaskById(id);
  }

  @Put(':id')
  async updateTaskById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTaskDto: CreateTaskDto,
  ) {
    await this.taskService.updateTask(id, updateTaskDto);
  }

  @Delete(':id')
  async deleteTask(@Param('id', ParseIntPipe) id: number) {
    await this.taskService.deleteTask(id);
  }


  @Get(':id/tasks')
  getProjectTasks(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.getProjectTasks(id);
  }


  @Post(':projectId/new-task')
  createProjectTask(
    @Param('projectId', ParseIntPipe) id: number,
    @Body() CreateTaskDto: CreateTaskDto,
  ) {
    return this.taskService.createTask(id, CreateTaskDto);
  }
}