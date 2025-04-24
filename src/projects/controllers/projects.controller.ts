import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto } from '../dtos/create-project.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectService: ProjectsService) {}

  @Get('/my-projects')
  getUserProjectsQuery(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Req() req: any,
  ) {
    return this.projectService.findUserProjects(req.user, page, limit, search);
  }

  @Get('/')
  getProjects() {
    return this.projectService.findProjects();
  }

  @Get(':id')
  getProject(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.getProjectById(id);
  }

  @Put(':id')
  updateProjectById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProjectDto: CreateProjectDto,
  ) {
    return this.projectService.updateProject(id, updateProjectDto);
  }

  @Post(':id')
  deleteProject(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.deleteProject(id);
  }

  // @Get(':userId/projects/:projectId')
  // getUserProjectsPeer(
  //   @Param('userId', ParseIntPipe) userId: string,
  //   @Param('projectId', ParseIntPipe) projectId: string,
  // ) {
  //   return this.projectService.getUserProjectsPeer(userId, projectId);
  // }

  @Get('/:projectId/peers')
  getUserProjectsPeer(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.projectService.getProjectsPeer(projectId);
  }

  @Get(':projectId/tasks')
  getProjectTasks(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.projectService.getProjectTasks(projectId);
  }

  @Get(':id/projects')
  getUserProjects(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.getUserProjects(id);
  }

  @Post('/invite/:userId/:projectId')
  getTasks(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() { emails }: { emails: string[] }, // Destructure and rename
  ) {
    return this.projectService.sendProjectInvite(userId, projectId, emails);
  }

  @Post(':id/new-project')
  createUserProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() CreateProjectDto: CreateProjectDto,
  ) {
    return this.projectService.createProject(id, CreateProjectDto);
  }
}
