import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { WhiteboardsService } from '../services/whiteboards.service';
import { CreateWhiteboardDto } from '../dto/create-whiteboard.dto';
import { UpdateWhiteboardDto } from '../dto/update-whiteboard.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('whiteboards')
export class WhiteboardsController {
  constructor(private readonly whiteboardsService: WhiteboardsService) {}

  @Get()
  async getAllWhiteboards(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('projectId') projectId: string,
    @Query('orderBy') orderBy: string,
    @Query('sortBy') sortBy: string,
    @Query('group') group: string,
    @Req() req: any,
  ) {
    return this.whiteboardsService.getAllUserWhiteboards(
      req?.user,
      page,
      limit,
      search,
      projectId,
      orderBy,
      sortBy,
      group,
    );
  }

  @Get()
  async getWhiteboardState(
    @Query('projectId') projectId: string,
    @Req() req: any,
  ) {
    return await this.whiteboardsService.getWhiteboardState(Number(projectId));
  }

  @Patch('update-title')
  async updateWhiteboardTitle(
    @Body() body: { whiteboardId: string; title: string; userId: string },
  ) {
    await this.whiteboardsService.updateWhiteboardTitle(
      body.whiteboardId,
      body.title,
      body.userId,
    );
    return { success: true, message: 'Title updated successfully' };
  }

  @Post()
  create(@Body() uploadFileDto: any, @Req() req: any) {
    return this.whiteboardsService.create(uploadFileDto, req.user);
  }

  @Delete(':boardId')
  async deleteWhiteboard(@Param('boardId') boardId: string, @Req() req: any) {
    return this.whiteboardsService.deleteWhiteboard(boardId);
  }
}
