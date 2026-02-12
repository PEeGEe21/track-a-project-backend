import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { UserpeersService } from '../services/userpeers.service';
import { CreateUserpeerDto } from '../dto/create-userpeer.dto';
import { UpdateUserpeerDto } from '../dto/update-userpeer.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SubscriptionGuard } from 'src/common/guards/subscription.guard';

@UseGuards(JwtAuthGuard)
@Controller('userpeers')
export class UserpeersController {
  constructor(private readonly userpeersService: UserpeersService) {}

  @Post()
  create(@Body() createUserpeerDto: CreateUserpeerDto) {
    return this.userpeersService.create(createUserpeerDto);
  }

  @Get()
  findAll() {
    return this.userpeersService.findAll();
  }

  @Get('/my-peers')
  findUserPeers(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Req() req: any,
  ) {
    return this.userpeersService.findUserPeers(req.user, page, limit, search);
  }

  @Get('/team-members')
  findUserOrganizationPeers(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.userpeersService.findUserOrganizationPeers(req.user, organizationId, page, limit, search);
  }

  @Get('/my-peers-list')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  findTeamPeersList(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.userpeersService.findTeamPeersList(req.user, organizationId);
  }

  @Get('/my-peers-list2')
  findUserPeersList(@Req() req: any) {
    return this.userpeersService.findUserPeersList(req.user);
  }

  @Get('/my-peer-invites')
  findUserPeersInvite(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('status') status: string,
    @Req() req: any,
  ) {
    return this.userpeersService.findUserPeersInvite(
      req.user,
      page,
      limit,
      search,
      status,
    );
  }

  @Get('/my-peer-sent-invites')
  findUserPeersSentInvite(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('status') status: string,
    @Req() req: any,
  ) {
    return this.userpeersService.findUserPeersSentInvite(
      req.user,
      page,
      limit,
      search,
      status,
    );
  }

  @Get('/my-peer-invites-count')
  findUserPeersInviteCount(@Req() req: any) {
    return this.userpeersService.countPendingInvites(req.user);
  }

  @Post('/invite/accept/:id')
  acceptInvite(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.userpeersService.acceptInvite(req.user, +id, organizationId);
  }

  @Post('/invite/reject/:id')
  rejectInvite(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.userpeersService.rejectInvite(req.user, +id, organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userpeersService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserpeerDto: UpdateUserpeerDto,
  ) {
    return this.userpeersService.update(+id, updateUserpeerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userpeersService.remove(+id);
  }
}
