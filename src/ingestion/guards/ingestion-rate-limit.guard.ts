import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RedisThrottlerStorage } from 'src/common/rate-limit/redis-throttler.storage';
import { config } from 'src/config';

@Injectable()
export class IngestionRateLimitGuard implements CanActivate {
  constructor(
    private readonly throttlerStorage: RedisThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ingestionContext = request.ingestionContext;

    if (!ingestionContext?.ingestKeyId) {
      throw new HttpException(
        'Missing ingestion context',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const throttleKey = `key:${ingestionContext.ingestKeyId}`;
    const result = await this.throttlerStorage.increment(
      throttleKey,
      config.rateLimit.ingestionWindowMs,
      config.rateLimit.ingestionMax,
      config.rateLimit.ingestionWindowMs,
      'ingest',
    );

    if (result.isBlocked) {
      throw new HttpException(
        'Too many ingestion requests for this API key',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
