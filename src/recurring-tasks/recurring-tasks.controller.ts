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
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { CreateRecurrenceDto, UpdateRecurrenceDto } from './dto/recurrence.dto';
import { RecurringTasksService } from './recurring-tasks.service';

@Controller('task-recurrences')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.RECURRING_TASKS)
export class RecurringTasksController {
  constructor(private service: RecurringTasksService) {}
  @Get('tasks/:taskId/summary') summary(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.summaryForTask(taskId, req.user, org);
  }
  @Get('projects/:projectId') list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.list(projectId, req.user, org);
  }
  @Post('projects/:projectId') create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateRecurrenceDto,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.create(projectId, dto, req.user, org);
  }
  @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecurrenceDto,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.update(id, dto, req.user, org);
  }
  @Patch(':id/future-template')
  updateFuture(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: Record<string, unknown>,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.updateFutureTemplate(id, payload, req.user, org);
  }
  @Delete(':id') remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
    @Headers('x-organization-id') org: string,
  ) {
    return this.service.remove(id, req.user, org);
  }
}
