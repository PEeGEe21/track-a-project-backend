import { Controller, Get, Headers, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { EntitlementsService } from '../entitlements.service';

@Controller('entitlements')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get()
  getCurrentOrganizationEntitlements(
    @Headers('x-organization-id') organizationId: string,
    @Req() req: any,
  ) {
    return this.entitlementsService.resolveForActor(req.user, organizationId);
  }
}
