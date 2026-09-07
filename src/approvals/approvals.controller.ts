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
import {
  CreateApprovalDto,
  DelegateApprovalDto,
  RespondApprovalDto,
} from './dto/approval.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApiContractOperation,
  ApiObjectResponseDto,
  ApiOrganizationHeader,
  ApiStandardErrors,
} from 'src/common/openapi/api-contract.dto';
import {
  ApprovalListResponseDto,
  ApprovalResponseDto,
} from './dto/approval-contract.dto';
@Controller('approvals')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.BASIC_APPROVALS)
@ApiTags('Approvals')
@ApiBearerAuth()
@ApiOrganizationHeader()
@ApiStandardErrors({ forbidden: true })
export class ApprovalsController {
  constructor(private approvals: ApprovalsService) {}
  @Get('inbox')
  @ApiContractOperation(
    'List approvals assigned to the current user',
    ApprovalListResponseDto,
  )
  inbox(@Req() req: any, @Headers('x-organization-id') org: string) {
    return this.approvals.inbox(req.user, org);
  }
  @Get('projects/:projectId')
  @ApiContractOperation('List approvals for a project', ApprovalListResponseDto)
  list(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.approvals.list(req.user, org, projectId);
  }
  @Get('projects/:projectId/options')
  @ApiContractOperation('Get approval creation options', ApiObjectResponseDto)
  options(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.approvals.options(req.user, org, projectId);
  }
  @Post('projects/:projectId')
  @ApiContractOperation('Create an approval request', ApprovalResponseDto, 201)
  create(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateApprovalDto,
  ) {
    return this.approvals.create(req.user, org, projectId, dto);
  }
  @Get('projects/:projectId/:id')
  @ApiContractOperation('Get an approval request', ApprovalResponseDto)
  get(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.approvals.get(req.user, org, projectId, id);
  }
  @Post('projects/:projectId/:id/respond')
  @ApiContractOperation(
    'Respond to an approval request',
    ApprovalResponseDto,
    201,
  )
  respond(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondApprovalDto,
  ) {
    return this.approvals.respond(req.user, org, projectId, id, dto);
  }
  @Post('projects/:projectId/:id/delegate')
  @ApiContractOperation('Delegate an approval review', ApprovalResponseDto, 201)
  delegate(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DelegateApprovalDto,
  ) {
    return this.approvals.delegate(req.user, org, projectId, id, dto);
  }
}
