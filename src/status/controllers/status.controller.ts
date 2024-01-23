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
  @Get(':id/status')
  getTasks(@Param('id', ParseIntPipe) id: string) {
    return this.statusService.findStatuses(id);
  }

  @Get(':id')
  getProject(@Param('id', ParseIntPipe) id: number) {
    return this.statusService.getTaskById(id);
  }

  @Put(':id')
  async updateTaskById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: CreateStatusDto,
  ) {
    await this.statusService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  async deleteStatus(@Param('id', ParseIntPipe) id: number) {
    await this.statusService.deleteStatus(id);
  }



  @Post(':id/new-status')
  createProjectTask(
    @Param('id', ParseIntPipe) id: string,
    @Body() CreateStatusDto: CreateStatusDto,
  ) {
    return this.statusService.createStatus(id, CreateStatusDto);
  }
}