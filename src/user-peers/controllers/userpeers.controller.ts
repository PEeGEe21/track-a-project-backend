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
} from '@nestjs/common';
import { UserpeersService } from '../services/userpeers.service';
import { CreateUserpeerDto } from '../dto/create-userpeer.dto';
import { UpdateUserpeerDto } from '../dto/update-userpeer.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

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
