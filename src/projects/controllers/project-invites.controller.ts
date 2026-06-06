import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ProjectsService } from '../services/projects.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SubscriptionGuard } from 'src/common/guards/subscription.guard';

@Controller('project-invites')
export class ProjectInvitesController {
  constructor(private readonly projectService: ProjectsService) {}

  @Post('/check-status/:inviteCode/:projectId')
  checkProjectInviteCodeStatus(
    @Param('inviteCode') inviteCode: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.projectService.getPublicProjectInviteCodeStatus(
      inviteCode,
      projectId,
    );
  }

  @Post('/submit')
  submitProjectInviteCodeStatus(@Body() inviteData: any) {
    return this.projectService.submitProjectInviteCodeStatus(inviteData);
  }

  @Post('/accept-auth')
  @UseGuards(JwtAuthGuard)
  acceptProjectInviteForAuthenticatedUser(
    @Req() req: any,
    @Body() inviteData: any,
  ) {
    return this.projectService.acceptProjectInviteByCode(
      req.user,
      inviteData?.inviteCode,
      inviteData?.projectId,
    );
  }

  @Post('/generate-link/:projectId')
  @UseGuards(
    JwtAuthGuard,
    OrganizationAccessGuard,
    RolesGuard,
    SubscriptionGuard,
  )
  generateProjectInviteLink(
    @Req() req: any,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.projectService.generateProjectInviteLink(
      req.user,
      projectId,
      organizationId,
    );
  }
}
