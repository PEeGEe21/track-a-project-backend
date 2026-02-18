import { Body, Controller, Param, Post } from '@nestjs/common';
import { BillingService } from '../services/billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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
