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
import { ProjectPeersService } from '../services/project-peers.service';

@Controller('peers')
export class ProjectPeersController {
  constructor(private projectPeerService: ProjectPeersService) {}
  @Get('/')
  getTasks() {
    return this.projectPeerService.findTasks();
  }

  @Get(':id')
  getProject(@Param('id', ParseIntPipe) id: number) {
    return this.projectPeerService.getTaskById(id);
  }

  @Get(':id/peers')
  getProjectPeers(@Param('id', ParseIntPipe) id: number) {
    return this.projectPeerService.getTaskById(id);
  }

  @Put(':id')
  async updateTaskById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTaskDto: CreateTaskDto,
  ) {
    await this.projectPeerService.updateTask(id, updateTaskDto);
  }

  @Delete(':id')
  async deleteTask(@Param('id', ParseIntPipe) id: number) {
    await this.projectPeerService.deleteTask(id);
  }

  @Get(':id/tasks')
  getProjectTasks(@Param('id', ParseIntPipe) id: number) {
    return this.projectPeerService.getProjectTasks(id);
  }

  @Post(':id/task')
  createProjectTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() CreateTaskDto: CreateTaskDto,
  ) {
    return this.projectPeerService.createTask(id, CreateTaskDto);
  }
}
