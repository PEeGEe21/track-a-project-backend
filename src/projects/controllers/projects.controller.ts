import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Post,
  Patch,
  Put,
  UseGuards,
  Req,
  Headers,
  Res,
} from '@nestjs/common';
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto } from '../dtos/create-project.dto';
import { UpdateProjectDto } from '../dtos/update-project.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SubscriptionGuard } from 'src/common/guards/subscription.guard';
import { Response } from 'express';
import { CreateIngestKeyDto } from '../dtos/create-ingest-key.dto';
import { UpdateDefaultIngestionStatusDto } from '../dtos/update-default-ingestion-status.dto';
import { UpdateProjectMemberRoleDto } from '../dtos/update-project-member-role.dto';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { ProjectNavigationDto } from '../dtos/project-navigation.dto';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  ApiContractOperation,
  ApiOrganizationHeader,
  ApiStandardErrors,
} from 'src/common/openapi/api-contract.dto';
import {
  ProjectInviteRequestDto,
  ProjectListResponseDto,
  ProjectOperationResponseDto,
  ProjectResponseDto,
} from '../dtos/project-contract.dto';

@UseGuards(JwtAuthGuard)
@Controller('projects')
@ApiTags('Projects')
@ApiBearerAuth()
@ApiOrganizationHeader()
@ApiStandardErrors({ forbidden: true })
export class ProjectsController {
  constructor(private projectService: ProjectsService) {}

  @Post(':id/navigation')
  @ApiContractOperation(
    'Record project navigation',
    ProjectOperationResponseDto,
    201,
  )
  @UseGuards(OrganizationAccessGuard)
  recordProjectNavigation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProjectNavigationDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.recordProjectNavigation(
      req.user,
      organizationId,
      id,
      dto.navigationSource,
    );
  }

  @Get('/activity-chart')
  @ApiContractOperation(
    'Get project activity chart',
    ProjectOperationResponseDto,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  findProjectActivitiesChart(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Query('period') period: any,
    @Query('projectId') projectId: any,
    @Query('userId') userId?: any,
  ) {
    return this.projectService.findProjectActivitiesChart(
      req.user,
      organizationId,
      period,
      projectId,
      userId,
    );
  }

  @Get('/my-projects')
  @ApiContractOperation(
    'List projects available to the current user',
    ProjectListResponseDto,
  )
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
  @ApiContractOperation('List project invitations', ProjectOperationResponseDto)
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
  @ApiContractOperation('List project activity', ProjectOperationResponseDto)
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
      projectId,
      type,
    );
  }

  @Post('/new-project')
  @ApiContractOperation('Create a project', ProjectResponseDto, 201)
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  createUserProject(
    @Body() createProjectDto: CreateProjectDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.createProject(
      req.user,
      organizationId,
      createProjectDto,
    );
  }

  @Get(':id/overview')
  @ApiContractOperation('Get a project overview', ProjectOperationResponseDto)
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
  @ApiContractOperation(
    'Get project member analytics',
    ProjectOperationResponseDto,
  )
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
  @ApiContractOperation(
    'Delete a project through the legacy endpoint',
    ProjectOperationResponseDto,
    201,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  deleteProject(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.deleteProject(req.user, id, organizationId);
  }

  @Get('/:projectId/peers')
  @ApiContractOperation('List project peers', ProjectOperationResponseDto)
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

  @Get(':projectId/members')
  @ApiContractOperation('List project members', ProjectOperationResponseDto)
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  listProjectMembers(
    @Req() req: any,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.listProjectMembers(
      req.user,
      projectId,
      organizationId,
    );
  }

  @Get(':projectId/invite-candidates')
  @ApiContractOperation(
    'List eligible project invite candidates',
    ProjectOperationResponseDto,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  listProjectInviteCandidates(
    @Req() req: any,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('search') search: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.listProjectInviteCandidates(
      req.user,
      projectId,
      organizationId,
      search,
      page,
      limit,
    );
  }

  @Patch(':projectId/members/:userId/role')
  @ApiContractOperation(
    'Update a project member role',
    ProjectOperationResponseDto,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  updateProjectMemberRole(
    @Req() req: any,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateProjectMemberRoleDto,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.updateProjectMemberRole(
      req.user,
      projectId,
      userId,
      dto.role,
      organizationId,
    );
  }

  @Get(':projectId/ingest-keys')
  @ApiContractOperation(
    'List project ingestion keys',
    ProjectOperationResponseDto,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  listIngestKeys(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.listIngestKeysForProject(
      req.user,
      projectId,
      organizationId,
    );
  }

  @Post(':projectId/ingest-keys/live')
  @ApiContractOperation(
    'Create a live ingestion key',
    ProjectOperationResponseDto,
    201,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  createLiveIngestKey(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateIngestKeyDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.createIngestKeyForProject(
      req.user,
      projectId,
      organizationId,
      'live',
      dto,
    );
  }

  @Post(':projectId/ingest-keys/test')
  @ApiContractOperation(
    'Create a test ingestion key',
    ProjectOperationResponseDto,
    201,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  createTestIngestKey(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateIngestKeyDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.createIngestKeyForProject(
      req.user,
      projectId,
      organizationId,
      'test',
      dto,
    );
  }

  @Delete(':projectId/ingest-keys/:keyId')
  @ApiContractOperation(
    'Revoke a project ingestion key',
    ProjectOperationResponseDto,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  revokeIngestKey(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('keyId', ParseIntPipe) keyId: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.revokeIngestKeyForProject(
      req.user,
      projectId,
      keyId,
      organizationId,
    );
  }

  @Put(':projectId/default-ingestion-status')
  @ApiContractOperation(
    'Update default ingestion behavior',
    ProjectOperationResponseDto,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  updateDefaultIngestionStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: UpdateDefaultIngestionStatusDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.updateDefaultIngestionStatus(
      req.user,
      projectId,
      organizationId,
      dto.default_ingestion_status_id,
      dto.ingestion_closed_task_dedupe_behavior,
      dto.closed_task_reopen_window_days,
    );
  }

  @Get(':id')
  @ApiContractOperation('Get a project', ProjectResponseDto)
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getProject(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.getProjectById(id, req.user, organizationId);
  }

  @Get(':id/export')
  @ApiContractOperation(
    'Export a project workbook',
    ProjectOperationResponseDto,
  )
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  async exportProject(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Res() res: Response,
  ) {
    const exportFile = await this.projectService.exportProjectWorkbook(
      id,
      req.user,
      organizationId,
    );

    res.setHeader('Content-Type', exportFile.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportFile.filename}"`,
    );
    res.send(exportFile.content);
  }

  @Get('/:projectId/comments')
  @ApiContractOperation('List project comments', ProjectOperationResponseDto)
  getProjectComments(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.getProjectComments(
      req.user,
      projectId,
      organizationId,
    );
  }

  @Get('/entity-check-comments')
  @ApiContractOperation(
    'Check project-comment session context',
    ProjectOperationResponseDto,
  )
  checkSessionTimezone(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.checkSessionTimezone(req.user);
  }

  @Get('/user-comments')
  @ApiContractOperation(
    'List projects with comments for the current user',
    ProjectOperationResponseDto,
  )
  getProjectsForUser(@Req() req: any) {
    return this.projectService.getProjectsForUser(req.user);
  }

  @Post('/:projectId/comments')
  @ApiContractOperation(
    'Create a project comment',
    ProjectOperationResponseDto,
    201,
  )
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
  @ApiContractOperation(
    'Accept a project invitation',
    ProjectOperationResponseDto,
    201,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  acceptInvite(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.acceptPeerInvite(req.user, +id, organizationId);
  }

  @Post('/project-peers/invite/reject/:id')
  @ApiContractOperation(
    'Reject a project invitation',
    ProjectOperationResponseDto,
    201,
  )
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
  @ApiContractOperation(
    'Count pending project invitations',
    ProjectOperationResponseDto,
  )
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
  @ApiContractOperation(
    'List projects in the active organization',
    ProjectListResponseDto,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getProjects(@Headers('x-organization-id') organizationId: string) {
    return this.projectService.findProjects();
  }

  @Put(':id')
  @ApiContractOperation('Update a project', ProjectResponseDto)
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  updateProjectById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProjectDto: UpdateProjectDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.updateProject(
      id,
      updateProjectDto,
      req.user,
      organizationId,
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
  @ApiContractOperation('List tasks for a project', ProjectOperationResponseDto)
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
  @ApiContractOperation('List projects for a user', ProjectListResponseDto)
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getUserProjects(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.getUserProjects(id, organizationId);
  }

  @Post('/invite/:projectId')
  @ApiContractOperation(
    'Invite members to a project',
    ProjectOperationResponseDto,
    201,
  )
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  getTasks(
    @Req() req: any,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() { emails, role }: ProjectInviteRequestDto,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.sendProjectInvite(
      req.user,
      projectId,
      emails,
      organizationId,
      role,
    );
  }
}
