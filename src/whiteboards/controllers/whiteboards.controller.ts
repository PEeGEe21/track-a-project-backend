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
  Headers,
} from '@nestjs/common';
import { WhiteboardsService } from '../services/whiteboards.service';
import { CreateWhiteboardDto } from '../dto/create-whiteboard.dto';
import { UpdateWhiteboardDto } from '../dto/update-whiteboard.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from 'src/common/guards/subscription.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@UseGuards(JwtAuthGuard)
@Controller('whiteboards')
export class WhiteboardsController {
  constructor(private readonly whiteboardsService: WhiteboardsService) {}

  @Get()
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  async getAllWhiteboards(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('projectId') projectId: string,
    @Query('orderBy') orderBy: string,
    @Query('sortBy') sortBy: string,
    @Query('group') group: string,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.whiteboardsService.getAllUserWhiteboards(
      req?.user,
      organizationId,
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
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  async getWhiteboardState(
    @Headers('x-organization-id') organizationId: string,
    @Query('projectId') projectId: string,
    @Req() req: any,
  ) {
    return await this.whiteboardsService.getWhiteboardState(
      organizationId,
      Number(projectId),
    );
  }

  @Patch('update-title')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
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
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  create(
    @Headers('x-organization-id') organizationId: string,
    @Body() uploadFileDto: any,
    @Req() req: any,
  ) {
    return this.whiteboardsService.create(
      uploadFileDto,
      req.user,
      organizationId,
    );
  }

  @Delete(':boardId')
  @UseGuards(OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
  async deleteWhiteboard(
    @Headers('x-organization-id') organizationId: string,
    @Param('boardId') boardId: string,
    @Req() req: any,
  ) {
    return this.whiteboardsService.deleteWhiteboard(boardId, organizationId);
  }
}
