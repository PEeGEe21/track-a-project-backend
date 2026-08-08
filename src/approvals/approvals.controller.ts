import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto, RespondApprovalDto } from './dto/approval.dto';
@Controller('approvals')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.BASIC_APPROVALS)
export class ApprovalsController {
  constructor(private approvals: ApprovalsService) {}
  @Get('inbox') inbox(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
  ) {
    return this.approvals.inbox(req.user, org);
  }
  @Get('projects/:projectId') list(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.approvals.list(req.user, org, projectId);
  }
  @Get('projects/:projectId/options') options(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.approvals.options(req.user, org, projectId);
  }
  @Post('projects/:projectId') create(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateApprovalDto,
  ) {
    return this.approvals.create(req.user, org, projectId, dto);
  }
  @Get('projects/:projectId/:id') get(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.approvals.get(req.user, org, projectId, id);
  }
  @Post('projects/:projectId/:id/respond') respond(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondApprovalDto,
  ) {
    return this.approvals.respond(req.user, org, projectId, id, dto);
  }
}
