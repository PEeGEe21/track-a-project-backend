import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { UserPushSubscription } from 'src/typeorm/entities/UserPushSubscription';
import { RegisterPushSubscriptionDto } from '../dto/register-push-subscription.dto';
import { config } from 'src/config';

@Injectable()
export class PushSubscriptionsService {
  constructor(
    @InjectRepository(UserPushSubscription)
    private readonly pushSubscriptionRepository: Repository<UserPushSubscription>,
  ) {}

  getClientConfig() {
    return {
      enabled: Boolean(config.webPush.publicKey),
      publicKey: config.webPush.publicKey,
    };
  }

  async registerForUser(
    userId: number,
    subscription: RegisterPushSubscriptionDto,
  ) {
    const endpointHash = this.hashEndpoint(subscription.endpoint);

    let existingSubscription = await this.pushSubscriptionRepository.findOne({
      where: { endpoint_hash: endpointHash },
    });

    if (!existingSubscription) {
      existingSubscription = this.pushSubscriptionRepository.create({
        user: { id: userId } as any,
        endpoint: subscription.endpoint,
        endpoint_hash: endpointHash,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        expiration_time: subscription.expirationTime ?? null,
        user_agent: subscription.userAgent ?? null,
        last_seen_at: new Date(),
      });
    } else {
      existingSubscription.user = { id: userId } as any;
      existingSubscription.endpoint = subscription.endpoint;
      existingSubscription.p256dh = subscription.keys.p256dh;
      existingSubscription.auth = subscription.keys.auth;
      existingSubscription.expiration_time =
        subscription.expirationTime ?? null;
      existingSubscription.user_agent = subscription.userAgent ?? null;
      existingSubscription.last_seen_at = new Date();
    }

    return this.pushSubscriptionRepository.save(existingSubscription);
  }

  async removeForUser(userId: number, endpoint: string) {
    const endpointHash = this.hashEndpoint(endpoint);
    await this.pushSubscriptionRepository.delete({
      endpoint_hash: endpointHash,
      user: { id: userId } as any,
    });
  }

  async getSubscriptionsForUser(userId: number) {
    return this.pushSubscriptionRepository.find({
      where: { user: { id: userId } },
      order: { updated_at: 'DESC' },
    });
  }

  async removeByEndpointHash(endpointHash: string) {
    await this.pushSubscriptionRepository.delete({
      endpoint_hash: endpointHash,
    });
  }

  private hashEndpoint(endpoint: string) {
    return createHash('sha256').update(endpoint).digest('hex');
  }

  hashSubscriptionEndpoint(endpoint: string) {
    return this.hashEndpoint(endpoint);
  }
}
