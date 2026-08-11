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
  CreateIntakeEmailAddressDto,
  UpdateIntakeEmailAddressDto,
} from '../dto/intake-email.dto';
import { IntakeEmailService } from '../services/intake-email.service';
@Controller('projects/:projectId/intake/email-addresses')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.UNIVERSAL_INTAKE)
export class IntakeEmailController {
  constructor(private readonly email: IntakeEmailService) {}
  @Get() list(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.email.list(req.user, org, projectId);
  }
  @Post() create(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateIntakeEmailAddressDto,
  ) {
    return this.email.create(req.user, org, projectId, dto);
  }
  @Patch(':id') update(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIntakeEmailAddressDto,
  ) {
    return this.email.update(req.user, org, projectId, id, dto);
  }
  @Post(':id/rotate') rotate(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.email.rotate(req.user, org, projectId, id);
  }
}
