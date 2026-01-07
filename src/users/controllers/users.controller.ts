import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  SerializeOptions,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreateUserDto } from '../dtos/CreateUser.dto';
//   import { CreateUserPostDto } from '../../dtos/CreateUserPost.dto';
import { CreateUserProfileDto } from '../dtos/CreateUserProfile.dto';
import { UpdateUserDto } from '../dtos/UpdateUser.dto';
import { UsersService } from '../services/users.service';
import { UpdateUserPasswordDto } from '../dtos/UpdateUserPassword.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FindUsersQueryDto } from '../dtos/FindUsersQuery.dto';

@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) {}

  // ============================================
  // Super Admin Routes
  // ============================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Get('/')
  findAllUsers(@Query() query: FindUsersQueryDto, @Req() req: any) {
    return this.userService.findAllUsers(req.user, query);
  }

  // @UseGuards(JwtAuthGuard)
  // @Get('/')
  // getUsers() {
  //   return this.userService.findUsers();
  // }

  @UseGuards(JwtAuthGuard)
  @Get('/profile')
  getUserProfile(@Req() req: any) {
    return this.userService.getUserProfile(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/dashboard')
  getUserDashboardData(@Req() req: any) {
    return this.userService.getUserDashboardData(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/send-peer-invite')
  sendPeerInvite(@Body() inviteData: any, @Req() req: any) {
    return this.userService.sendPeerInvite(req.user, inviteData);
  }

  @Post('/check-invite-code-status/:inviteCode')
  checkPeerInviteCodeStatus(@Param('inviteCode') inviteCode: string) {
    return this.userService.getPeerInviteCodeStatus(inviteCode);
  }

  @Post('/submit-peer-invite-code')
  submitPeerInviteCodeStatus(@Body() inviteData: any) {
    return this.userService.submitPeerInviteCodeStatus(inviteData);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getUser(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getUserAccountById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/peers')
  getUserPeers(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getUserPeersById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/create-user')
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateUserById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    await this.userService.updateUser(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteUserById(@Param('id', ParseIntPipe) id: number) {
    await this.userService.deleteUser(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/save-profile')
  updateUserProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserProfileDto: CreateUserProfileDto,
  ) {
    return this.userService.updateUserProfile(id, updateUserProfileDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/update-password')
  updateUserPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() UpdateUserPasswordDto: UpdateUserPasswordDto,
  ) {
    return this.userService.updateUserPassword(id, UpdateUserPasswordDto);
  }
  // @Post(':id/profile')
  // createUserProfile(
  //   @Param('id', ParseIntPipe) id: string,
  //   @Body() upadteUserProfileDto: CreateUserProfileDto,
  // ) {
  //   return this.userService.updateUserProfile(id, upadteUserProfileDto);
  // }

  @UseGuards(JwtAuthGuard)
  @Get(':id/settings')
  getUserSettings(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getUserSettings(id);
  }
}
