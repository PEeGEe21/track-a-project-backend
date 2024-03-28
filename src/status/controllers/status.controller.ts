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
import { CreateStatusDto } from '../dtos/create-status.dto';
import { StatusService } from '../services/status.service';

@Controller('status')
export class StatusController {
  constructor(private statusService: StatusService) {}
  @Get(':userId/:projectId/status')
  getTasks(@Param('userId', ParseIntPipe) userId: string,
  @Param('projectId', ParseIntPipe) projectId: number) {
    return this.statusService.findStatuses(userId, projectId);
  }

  @Get(':id')
  getProject(@Param('id', ParseIntPipe) id: number) {
    return this.statusService.getTaskById(id);
  }

  @Put(':id')
  updateStatusById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: CreateStatusDto,
  ) {
    return this.statusService.updateStatus(id, updateStatusDto);
  }

  @Post(':id')
  deleteStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() type: number) {
    return this.statusService.deleteStatus(id, type);
  }



  @Post(':id/new-status')
  createProjectTask(
    @Param('id', ParseIntPipe) id: string,
    @Body() CreateStatusDto: CreateStatusDto,
  ) {
    return this.statusService.createStatus(id, CreateStatusDto);
  }
}