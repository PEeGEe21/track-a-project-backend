import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { BillingService } from '../services/billing.service';
// import { StripeService } from './stripe.service';

@Controller('billing/webhooks')
export class StripeWebhookController {
  constructor(
    private readonly billingService: BillingService,
    // private readonly stripeService: StripeService,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Body() rawBody: Buffer | string,
  ) {
    // TODO: verify signature using stripe.webhookSecret
    // const event = this.stripeService.constructEvent(rawBody, signature);

    console.log('[Webhook] Received Stripe event' /* event.type */);

    // switch (event.type) {
    //   case 'customer.subscription.updated':
    //     await this.billingService.handleSubscriptionUpdated(event.data.object);
    //     break;
    //   case 'customer.subscription.deleted':
    //     await this.billingService.handleSubscriptionDeleted(event.data.object);
    //     break;
    //   case 'invoice.paid':
    //     await this.billingService.handleInvoicePaid(event.data.object);
    //     break;
    //   // ... more cases
    //   default:
    //     console.log(`Unhandled event type ${event.type}`);
    // }

    return { received: true };
  }
}
