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
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto } from '../dtos/create-project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private projectService: ProjectsService) {}
  @Get('/')
  getProjects() {
    return this.projectService.findProjects();
  }

  @Get(':id')
  getProject(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.getProjectById(id);
  }

  @Put(':id')
  async updateProjectById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProjectDto: CreateProjectDto,
  ) {
    await this.projectService.updateProject(id, updateProjectDto);
  }

  @Delete(':id')
  async deleteProject(@Param('id', ParseIntPipe) id: number) {

    const project = await this.projectService.deleteProject(id);

    if(project){
      return {
        success: 'success',
        message: 'successfully deleted'
      }
    } else{
      return {
        success: false,
        message: 'An error occurred'
      }
    }
  }

  // @Get(':userId/projects/:projectId')
  // getUserProjectsPeer(
  //   @Param('userId', ParseIntPipe) userId: string,
  //   @Param('projectId', ParseIntPipe) projectId: string,
  // ) {
  //   return this.projectService.getUserProjectsPeer(userId, projectId);
  // }

  @Get('/:projectId/peers')
  getUserProjectsPeer(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.projectService.getProjectsPeer(projectId);
  }

  @Get(':projectId/tasks')
  getProjectTasks(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.projectService.getProjectTasks(projectId);
  }

  @Get(':id/projects')
  getUserProjects(@Param('id', ParseIntPipe) id: string) {
    return this.projectService.getUserProjects(id);
  }

  @Post(':id/project')
  createUserProject(
    @Param('id', ParseIntPipe) id: string,
    @Body() CreateProjectDto: CreateProjectDto,
  ) {
    return this.projectService.createProject(id, CreateProjectDto);
  }
}
