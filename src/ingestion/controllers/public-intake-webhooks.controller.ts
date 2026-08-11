import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IntakeWebhookService } from '../services/intake-webhook.service';

@Controller('public/intake/webhooks')
export class PublicIntakeWebhooksController {
  constructor(private readonly webhooks: IntakeWebhookService) {}
  @Post(':publicKey')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  receive(
    @Param('publicKey') publicKey: string,
    @Headers() headers: Record<string, unknown>,
    @Body() payload: Record<string, unknown>,
    @Req() req: any,
  ) {
    return this.webhooks.receive(publicKey, headers, payload, req.rawBody);
  }
}
