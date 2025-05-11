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
    @Query('status') status: string,
    @Query('due_date') due_date: string,
    @Query('group') group: string,
    @Req() req: any,
  ) {
    return this.projectService.findUserProjects(
      req.user,
      page,
      limit,
      search,
      status,
      due_date,
      group,
    );
  }

  @Post('/new-project')
  createUserProject(@Body() CreateProjectDto: any, @Req() req: any) {
    return this.projectService.createProject(req.user, CreateProjectDto);
  }

  @Post('/delete/:id')
  deleteProject(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.projectService.deleteProject(req.user, id);
  }

  @Get('/:projectId/peers')
  getUserProjectsPeer(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('query') query: string,
    @Req() req: any,
  ) {
    return this.projectService.getProjectsPeer(req.user, projectId, query);
  }

  @Get('/:projectId/comments')
  getProjectComments(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: any,
  ) {
    return this.projectService.getProjectComments(req.user, projectId);
  }

  @Get('/entity-check-comments')
  checkSessionTimezone(@Req() req: any) {
    return this.projectService.checkSessionTimezone(req.user);
  }

  @Get('/user-comments')
  getProjectsForUser(@Req() req: any) {
    return this.projectService.getProjectsForUser(req.user);
  }

  @Post('/:projectId/comments')
  sendProjectComment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() commentData: any,
    @Req() req: any,
  ) {
    return this.projectService.sendProjectComment(
      req.user,
      projectId,
      commentData,
    );
  }

  @Get('/project-peer-invites')
  findProjectPeersInvite(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('status') status: string,
    @Query('type') type: string,
    @Req() req: any,
  ) {
    return this.projectService.findProjectPeersInvite(
      req.user,
      page,
      limit,
      search,
      status,
      type,
    );
  }

  @Post('/project-peers/invite/accept/:id')
  acceptInvite(@Param('id') id: string, @Req() req: any) {
    return this.projectService.acceptPeerInvite(req.user, +id);
  }

  @Post('/project-peers/invite/reject/:id')
  rejectInvite(@Param('id') id: string, @Req() req: any) {
    return this.projectService.rejectPeerInvite(req.user, +id);
  }

  // @Post('/project-peers/invite/reject/:id')
  // rejectInvite(@Param('id') id: string, @Req() req: any) {
  //   return this.projectService.rejectInvite(req.user, +id);
  // }

  @Get('/projects-invites-count')
  findProjectPeersInviteCount(@Req() req: any) {
    return this.projectService.countPendingPeerInvites(req.user);
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

  // @Get(':userId/projects/:projectId')
  // getUserProjectsPeer(
  //   @Param('userId', ParseIntPipe) userId: string,
  //   @Param('projectId', ParseIntPipe) projectId: string,
  // ) {
  //   return this.projectService.getUserProjectsPeer(userId, projectId);
  // }

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
}
