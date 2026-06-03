import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { BillingService } from '../services/billing.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ChangePlanDto } from '../dto/change-plan.dto';

@Controller('billing')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, RolesGuard)
@Roles('org_admin')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post(':id/change-plan')
  async changePlan(
    @Param('id') orgId: string,
    @Body(ValidationPipe) dto: ChangePlanDto,
    @Request() _req,
  ) {
    const result = await this.billingService.changePlan(orgId, dto.planCode);
    return { success: true, subscription: result };
  }

  @Post(':id/cancel-subscription')
  async cancel(
    @Param('id') orgId: string,
    @Body() dto: { immediate?: boolean },
  ) {
    const result = await this.billingService.cancelCurrentSubscription(
      orgId,
      dto.immediate ?? false,
    );
    return { success: true, subscription: result };
  }
}
