import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import {
  CreateWebhookSourceDto,
  RotateWebhookSecretDto,
  UpdateWebhookSourceDto,
} from '../dto/intake-webhook.dto';
import { IntakeWebhookService } from '../services/intake-webhook.service';

@Controller('projects/:projectId/intake/webhooks')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.UNIVERSAL_INTAKE)
export class IntakeWebhooksController {
  constructor(private readonly webhooks: IntakeWebhookService) {}
  @Get() list(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.webhooks.list(req.user, org, projectId);
  }
  @Post() create(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateWebhookSourceDto,
  ) {
    return this.webhooks.create(req.user, org, projectId, dto);
  }
  @Patch(':sourceId') update(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @Body() dto: UpdateWebhookSourceDto,
  ) {
    return this.webhooks.update(req.user, org, projectId, sourceId, dto);
  }
  @Post(':sourceId/rotate-secret') rotate(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @Body() dto: RotateWebhookSecretDto,
  ) {
    return this.webhooks.rotate(req.user, org, projectId, sourceId, dto);
  }
}
