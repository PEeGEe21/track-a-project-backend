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

@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // ============================================
  // Super Admin Routes
  // ============================================

  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @Get('/')
  findAll(@Query() query: FindOrganizationsQueryDto, @Req() req: any) {
    return this.organizationsService.findAll(req.user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.organizationsService.findOne(req.user, id);
  }

  @Get(':id/menus')
  getOrganizationMenus(@Param('id') id: string, @Req() req: any) {
    return this.organizationsService.getOrganizationMenus(req.user, id);
  }

  @Get(':id/team')
  findOneTeam(@Param('id') id: string, @Req() req: any) {
    return this.organizationsService.findOneTeam(req.user, id);
  }

  // @Post()
  // create(@Body() createOrganizationDto: CreateOrganizationDto) {
  //   return this.organizationsService.create(createOrganizationDto);
  // }

  @UseGuards(JwtAuthGuard, OrganizationAccessGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('logo'))
  @Patch(':id/account-update')
  update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateOrgDto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, updateOrgDto, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(+id);
  }

  @Post('invitations')
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
  @Patch('id/onboarding')
  markOrgOnboardingComplete(@Param('id') id: string) {
    console.log(id, 'idddd');
    return this.organizationsService.markOrgOnboardingComplete(id);
  }

  @Get('organization/:organizationId/invites')
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
  async getCurrentPlanAndLimits(@Param('id') orgId: string) {
    return this.organizationsService.getCurrentPlanAndLimits(orgId);
  }
}
