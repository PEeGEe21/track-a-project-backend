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
  Headers,
} from '@nestjs/common';
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto } from '../dtos/create-project.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SubscriptionGuard } from 'src/common/guards/subscription.guard';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectService: ProjectsService) {}

  @Get('/activity-chart')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  findProjectActivitiesChart(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Query('period') period: any,
    @Query('projectId') projectId: any,
    @Query('userId') userId?: any,
  ) {
    console.log('entereedd');
    return this.projectService.findProjectActivitiesChart(
      req.user,
      organizationId,
      period,
      projectId,
      userId,
    );
  }

  @Get('/my-projects')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getUserProjectsQuery(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('status') status: string,
    @Query('due_date') due_date: string,
    @Query('group') group: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.findUserProjects(
      req.user,
      organizationId,
      page,
      limit,
      search,
      status,
      due_date,
      group,
    );
  }

  @Get('/project-peer-invites')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  findProjectPeersInvite(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('status') status: string,
    @Query('type') type: string,
    @Query('orderBy') orderBy: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.findProjectPeersInvite(
      req.user,
      organizationId,
      page,
      limit,
      search,
      status,
      type,
      orderBy,
    );
  }

  @Get('/activity')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  findProjectActivity(
    @Query('page') page: any,
    @Query('limit') limit: any,
    @Query('search') search: string,
    @Query('type') type: string,
    @Query('projectId') projectId: any,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.findProjectActivities(
      req.user,
      organizationId,
      page,
      limit,
      search,
      type,
      projectId,
    );
  }

  @Post('/new-project')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  createUserProject(
    @Body() CreateProjectDto: any,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.createProject(
      req.user,
      organizationId,
      CreateProjectDto,
    );
  }

  @Get(':id/overview')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getProjectOverview(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.projectOverviewData(
      id,
      req.user,
      organizationId,
    );
  }

  @Get('peer-analytics/:id/:peerId')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getProjectPeerAnalytics(
    @Param('id', ParseIntPipe) id: number,
    @Param('peerId', ParseIntPipe) peerId: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.projectPeerAnalytics(
      id,
      peerId,
      req.user,
      organizationId,
    );
  }

  @Post('/delete/:id')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  deleteProject(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.deleteProject(req.user, id, organizationId);
  }

  @Get('/:projectId/peers')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getUserProjectsPeer(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('query') query: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.getProjectsPeer(
      req.user,
      projectId,
      organizationId,
      query,
    );
  }

  @Get(':id')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getProject(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.getProjectById(id, req.user);
  }

  @Get('/:projectId/comments')
  getProjectComments(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.getProjectComments(req.user, projectId);
  }

  @Get('/entity-check-comments')
  checkSessionTimezone(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.checkSessionTimezone(req.user);
  }

  @Get('/user-comments')
  getProjectsForUser(
    @Req() req: any,
  ) {
    return this.projectService.getProjectsForUser(req.user);
  }

  @Post('/:projectId/comments')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  sendProjectComment(
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() commentData: any,
    @Req() req: any,
  ) {
    return this.projectService.sendProjectComment(
      req.user,
      projectId,
      commentData,
      organizationId,
    );
  }

  @Post('/project-peers/invite/accept/:id')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  acceptInvite(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.acceptPeerInvite(req.user, +id, organizationId);
  }

  @Post('/project-peers/invite/reject/:id')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  rejectInvite(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.rejectPeerInvite(req.user, +id, organizationId);
  }

  // @Post('/project-peers/invite/reject/:id')
  // rejectInvite(@Param('id') id: string, @Req() req: any) {
  //   return this.projectService.rejectInvite(req.user, +id);
  // }

  @Get('/projeorganizationIdcts-invites-count')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  findProjectPeersInviteCount(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.countPendingPeerInvites(
      req.user,
      organizationId,
    );
  }

  @Get('/')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getProjects(@Headers('x-organization-id') organizationId: string) {
    return this.projectService.findProjects();
  }

  @Put(':id')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  updateProjectById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProjectDto: CreateProjectDto,
  ) {
    return this.projectService.updateProject(
      id,
      updateProjectDto,
    );
  }

  // @Get(':userId/projects/:projectId')
  // getUserProjectsPeer(
  //   @Param('userId', ParseIntPipe) userId: string,
  //   @Param('projectId', ParseIntPipe) projectId: string,
  // ) {
  //   return this.projectService.getUserProjectsPeer(userId, projectId);
  // }

  @Get(':projectId/tasks')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getProjectTasks(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.getProjectTasks(
      projectId,
      req.user,
      organizationId,
    );
  }

  @Get(':id/projects')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getUserProjects(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.getUserProjects(id, organizationId);
  }

  @Post('/invite/:userId/:projectId')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getTasks(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() { emails }: { emails: string[] }, // Destructure and rename
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.sendProjectInvite(
      userId,
      projectId,
      emails,
      organizationId,
    );
  }
}
