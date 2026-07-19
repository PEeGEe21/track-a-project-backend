import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { TaskDiscussionsService } from './task-discussions.service';
@Controller('tasks/:taskId/discussion')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class TaskDiscussionsController {
  constructor(private s: TaskDiscussionsService) {}
  @Get() list(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('taskId', ParseIntPipe) t: number,
    @Query('page') p?: number,
    @Query('limit') l?: number,
  ) {
    return this.s.list(r.user, o, t, p, l);
  }
  @Get('mention-options')
  mentions(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('taskId', ParseIntPipe) t: number,
  ) {
    return this.s.mentionOptions(r.user, o, t);
  }
  @Post() create(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('taskId', ParseIntPipe) t: number,
    @Body() d: any,
  ) {
    return this.s.create(r.user, o, t, d);
  }
  @Patch(':id') edit(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('taskId', ParseIntPipe) t: number,
    @Param('id') i: string,
    @Body() d: any,
  ) {
    return this.s.edit(r.user, o, t, i, d.content);
  }
  @Delete(':id') remove(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('taskId', ParseIntPipe) t: number,
    @Param('id') i: string,
  ) {
    return this.s.remove(r.user, o, t, i);
  }
  @Post(':id/reactions') react(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('taskId', ParseIntPipe) t: number,
    @Param('id') i: string,
    @Body() d: any,
  ) {
    return this.s.react(r.user, o, t, i, d.emoji);
  }
  @Post(':id/resolve') resolve(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('taskId', ParseIntPipe) t: number,
    @Param('id') i: string,
    @Body() d: any,
  ) {
    return this.s.resolve(r.user, o, t, i, d.resolved);
  }
  @Get(':id/history') history(
    @Req() r: any,
    @Headers('x-organization-id') o: string,
    @Param('taskId', ParseIntPipe) t: number,
    @Param('id') i: string,
  ) {
    return this.s.history(r.user, o, t, i);
  }
}
