import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateStatusDto } from '../dtos/create-status.dto';
import { StatusService } from '../services/status.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('status')
export class StatusController {
  constructor(private statusService: StatusService) {}
  @Get('/:projectId')
  getStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: any,
  ) {
    return this.statusService.findStatuses(projectId, req?.user);
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

  @Delete(':id')
  deleteStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: any,
    @Req() req: any,
  ) {
    return this.statusService.deleteStatus(id, payload, req.user);
  }

  @Post('/')
  createProjectTask(@Body() CreateStatusDto: CreateStatusDto, @Req() req: any) {
    return this.statusService.createStatus(req, CreateStatusDto);
  }
}
