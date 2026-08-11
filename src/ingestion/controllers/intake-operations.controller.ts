import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { IngestionService } from '../services/ingestion.service';

@Controller('projects/:projectId/intake/events')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.UNIVERSAL_INTAKE)
export class IntakeOperationsController {
  constructor(private readonly ingestion: IngestionService) {}

  @Get()
  list(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('state') state?: any,
    @Query('channel') channel?: any,
  ) {
    return this.ingestion.listIntakeEvents(
      req.user,
      organizationId,
      projectId,
      {
        page: Number(page) || 1,
        limit: Number(limit) || 25,
        state,
        channel,
      },
    );
  }

  @Get(':eventId')
  get(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.ingestion.getIntakeEvent(
      req.user,
      organizationId,
      projectId,
      eventId,
    );
  }

  @Post(':eventId/retry')
  retry(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.ingestion.retryIntakeEvent(
      req.user,
      organizationId,
      projectId,
      eventId,
    );
  }

  @Post(':eventId/reprocess')
  reprocess(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.ingestion.retryIntakeEvent(
      req.user,
      organizationId,
      projectId,
      eventId,
      true,
    );
  }
}
