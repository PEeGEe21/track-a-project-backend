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
import { CreateUserDto } from '../dtos/CreateUser.dto';
//   import { CreateUserPostDto } from '../../dtos/CreateUserPost.dto';
import { CreateUserProfileDto } from '../dtos/CreateUserProfile.dto';
import { UpdateUserDto } from '../dtos/UpdateUser.dto';
import { UsersService } from '../services/users.service';
import { UpdateUserPasswordDto } from '../dtos/UpdateUserPassword.dto';

@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) {}
  @Get('/')
  getUsers() {
    return this.userService.findUsers();
  }

  @Get(':id')
  getUser(@Param('id', ParseIntPipe) id: string) {
    return this.userService.getUserAccountById(id);
  }

  @Get(':id/peers')
  getUserPeers(@Param('id', ParseIntPipe) id: string) {
    return this.userService.getUserPeersById(id);
  }

  @Post('/create-user')
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Put(':id')
  async updateUserById(
    @Param('id', ParseIntPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    await this.userService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  async deleteUserById(@Param('id', ParseIntPipe) id: string) {
    await this.userService.deleteUser(id);
  }

  @Post(':id/save-profile')
  updateUserProfile(
    @Param('id', ParseIntPipe) id: string,
    @Body() updateUserProfileDto: CreateUserProfileDto,
  ) {
    return this.userService.updateUserProfile(id, updateUserProfileDto);
  }

  @Post(':id/update-password')
  updateUserPassword(
    @Param('id', ParseIntPipe) id: string,
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

  @Get(':id/settings')
  getUserSettings(@Param('id', ParseIntPipe) id: string) {
    return this.userService.getUserSettings(id);
  }

  //   @Post(':id/posts')
  //   createUserPost(
  //     @Param('id', ParseIntPipe) id: number,
  //     @Body() createUserPostDto: CreateUserPostDto,
  //   ) {
  //     return this.userService.createUserPost(id, createUserPostDto);
  //   }
}
