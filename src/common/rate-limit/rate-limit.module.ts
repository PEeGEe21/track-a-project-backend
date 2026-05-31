import { Global, Module } from '@nestjs/common';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { WebsocketRateLimiterService } from './websocket-rate-limiter.service';

@Global()
@Module({
  providers: [
    ThrottlerStorageService,
    RedisThrottlerStorage,
    WebsocketRateLimiterService,
  ],
  exports: [
    ThrottlerStorageService,
    RedisThrottlerStorage,
    WebsocketRateLimiterService,
  ],
})
export class RateLimitModule {}
