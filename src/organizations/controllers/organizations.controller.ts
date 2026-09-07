import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
  Request,
  ValidationPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { OrganizationsService } from '../services/organizations.service';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { FindOrganizationsQueryDto } from '../dto/FindOrganizationsQuery.dto';
import { InviteUserDto } from '../dto/invite-users.dto';
import { FindOrganizationsInvitesQuery } from '../dto/FindOrganizationsInvitesQuery.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { Throttle } from '@nestjs/throttler';
import { config } from 'src/config';
import { UpdateOrganizationMemberDto } from '../dto/update-organization-member.dto';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiOrganizationHeader,
  ApiStandardErrors,
  MessageResponseDto,
} from 'src/common/openapi/api-contract.dto';
import {
  InvitationActionResponseDto,
  OrganizationInvitationListResponseDto,
  OrganizationInvitationResponseDto,
  OrganizationListResponseDto,
  OrganizationMenusResponseDto,
  OrganizationMutationResponseDto,
  OrganizationPlanResponseDto,
  OrganizationResponseDto,
  OrganizationTeamMutationResponseDto,
  OrganizationTeamResponseDto,
} from '../dto/organization-contract.dto';

@UseGuards(JwtAuthGuard)
@Controller('organizations')
@ApiTags('Organizations')
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // ============================================
  // Super Admin Routes
  // ============================================

  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @Get('/')
  @ApiOperation({ summary: 'List organizations for platform administration' })
  @ApiOkResponse({ type: OrganizationListResponseDto })
  @ApiStandardErrors({ forbidden: true })
  findAll(@Query() query: FindOrganizationsQueryDto, @Req() req: any) {
    return this.organizationsService.findAll(req.user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an organization' })
  @ApiOkResponse({ type: OrganizationResponseDto })
  @ApiStandardErrors({ forbidden: true })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.organizationsService.findOne(req.user, id);
  }

  @Get(':id/menus')
  @ApiOperation({ summary: 'Get enabled navigation for an organization' })
  @ApiOkResponse({ type: OrganizationMenusResponseDto })
  @ApiStandardErrors({ forbidden: true })
  getOrganizationMenus(@Param('id') id: string, @Req() req: any) {
    return this.organizationsService.getOrganizationMenus(req.user, id);
  }

  @Get(':id/team')
  @ApiOperation({ summary: 'List organization members' })
  @ApiOkResponse({ type: OrganizationTeamResponseDto })
  @ApiStandardErrors({ forbidden: true })
  findOneTeam(@Param('id') id: string, @Req() req: any) {
    return this.organizationsService.findOneTeam(req.user, id);
  }

  @Patch(':id/team/:memberUserId')
  @ApiOperation({ summary: 'Change an organization member role' })
  @ApiOkResponse({ type: OrganizationTeamMutationResponseDto })
  @ApiStandardErrors({ forbidden: true })
  updateTeamMember(
    @Param('id') id: string,
    @Param('memberUserId') memberUserId: string,
    @Body(ValidationPipe) dto: UpdateOrganizationMemberDto,
    @Req() req: any,
  ) {
    return this.organizationsService.updateTeamMember(
      req.user,
      id,
      memberUserId,
      dto,
    );
  }

  @Delete(':id/team/:memberUserId')
  @ApiOperation({ summary: 'Remove an organization member' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiStandardErrors({ forbidden: true })
  removeTeamMember(
    @Param('id') id: string,
    @Param('memberUserId') memberUserId: string,
    @Req() req: any,
  ) {
    return this.organizationsService.removeTeamMember(
      req.user,
      id,
      memberUserId,
    );
  }

  // @Post()
  // create(@Body() createOrganizationDto: CreateOrganizationDto) {
  //   return this.organizationsService.create(createOrganizationDto);
  // }

  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('logo'))
  @Patch(':id/account-update')
  @ApiOperation({ summary: 'Update organization settings and branding' })
  @ApiConsumes('multipart/form-data')
  @ApiOrganizationHeader()
  @ApiOkResponse({ type: OrganizationMutationResponseDto })
  @ApiStandardErrors({ forbidden: true })
  update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateOrgDto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, updateOrgDto, file);
  }

  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, RolesGuard)
  @Roles('org_admin')
  @Post(':id/deadline-reminders/test')
  @ApiOperation({ summary: 'Send a deadline-reminder test as an admin' })
  @ApiOrganizationHeader()
  @ApiCreatedResponse({
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiStandardErrors({ forbidden: true })
  triggerDeadlineReminderTest(@Param('id') id: string, @Req() req: any) {
    return this.organizationsService.triggerDeadlineReminderTest(req.user, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an organization', deprecated: true })
  @ApiOkResponse({ schema: { type: 'string' } })
  @ApiStandardErrors({ forbidden: true })
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(+id);
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Invite a member to an organization' })
  @ApiCreatedResponse({ type: OrganizationInvitationResponseDto })
  @ApiStandardErrors({ forbidden: true })
  @Throttle({
    default: {
      limit: config.rateLimit.inviteMax,
      ttl: config.rateLimit.inviteWindowMs,
    },
  })
  async createInvitation(
    @Body(ValidationPipe) dto: InviteUserDto,
    @Request() req,
  ) {
    return this.organizationsService.createInvitation({
      ...dto,
      invited_by: req.user.userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/onboarding')
  @ApiOperation({ summary: 'Mark organization onboarding complete' })
  @ApiOkResponse({ type: OrganizationMutationResponseDto })
  @ApiStandardErrors({ forbidden: true })
  markOrgOnboardingComplete(@Param('id') id: string) {
    return this.organizationsService.markOrgOnboardingComplete(id);
  }

  @Get('organization/:organizationId/invites')
  @ApiOperation({ summary: 'List organization invitations' })
  @ApiOkResponse({ type: OrganizationInvitationListResponseDto })
  @ApiStandardErrors({ forbidden: true })
  async getOrganizationInvitations(
    @Param('organizationId') organizationId: string,
    @Query() query: FindOrganizationsInvitesQuery,
    @Request() req,
  ) {
    return this.organizationsService.getOrganizationInvitations(
      organizationId,
      query,
      req.user.userId,
    );
  }

  @Post('invitations/:invitationId/resend')
  @ApiOperation({ summary: 'Resend an organization invitation' })
  @ApiCreatedResponse({ type: InvitationActionResponseDto })
  @ApiStandardErrors({ forbidden: true })
  @Throttle({
    default: {
      limit: config.rateLimit.inviteMax,
      ttl: config.rateLimit.inviteWindowMs,
    },
  })
  async resendInvitation(
    @Param('invitationId') invitationId: string,
    @Request() req,
  ) {
    return this.organizationsService.resendInvitation(
      invitationId,
      req.user.userId,
    );
  }

  @Delete('invitations/:invitationId')
  @ApiOperation({ summary: 'Revoke an organization invitation' })
  @ApiOkResponse({ type: InvitationActionResponseDto })
  @ApiStandardErrors({ forbidden: true })
  async revokeInvitation(
    @Param('invitationId') invitationId: string,
    @Request() req,
  ) {
    return this.organizationsService.revokeInvitation(
      invitationId,
      req.user.userId,
    );
  }

  @Get(':id/current-plan')
  @ApiOperation({ summary: 'Get the active plan and organization limits' })
  @ApiOkResponse({ type: OrganizationPlanResponseDto })
  @ApiStandardErrors({ forbidden: true })
  async getCurrentPlanAndLimits(@Param('id') orgId: string) {
    return this.organizationsService.getCurrentPlanAndLimits(orgId);
  }
}
