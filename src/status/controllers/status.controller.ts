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
  Headers,
  UseGuards,
} from '@nestjs/common';
import { CreateStatusDto, UpdateStatusDto } from '../dtos/create-status.dto';
import { StatusService } from '../services/status.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';

@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller('status')
export class StatusController {
  constructor(private statusService: StatusService) {}
  @Get('/:projectId')
  getStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.statusService.findStatuses(
      projectId,
      req?.user,
      organizationId,
    );
  }

  @Get(':id')
  getProject(@Param('id', ParseIntPipe) id: number) {
    return this.statusService.getTaskById(id);
  }

  @Put(':id')
  updateStatusById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.statusService.updateStatus(
      id,
      updateStatusDto,
      req.user,
      organizationId,
    );
  }

  @Delete(':id')
  deleteStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: any,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.statusService.deleteStatus(
      id,
      payload,
      req.user,
      organizationId,
    );
  }

  @Post('/')
  createProjectTask(
    @Body() CreateStatusDto: CreateStatusDto,
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.statusService.createStatus(
      req.user,
      CreateStatusDto,
      organizationId,
    );
  }
}
