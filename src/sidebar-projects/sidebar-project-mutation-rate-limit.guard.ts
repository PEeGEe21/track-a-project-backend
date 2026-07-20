import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RedisThrottlerStorage } from 'src/common/rate-limit/redis-throttler.storage';

const LIMIT = 30;
const WINDOW_MS = 60_000;

@Injectable()
export class SidebarProjectMutationRateLimitGuard implements CanActivate {
  constructor(private readonly storage: RedisThrottlerStorage) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    if (!userId) return true;

    const result = await this.storage.increment(
      `sidebar-project-mutations:${userId}`,
      WINDOW_MS,
      LIMIT,
      WINDOW_MS,
      'sidebar-project-mutations',
    );
    if (result.isBlocked) {
      throw new HttpException(
        {
          message:
            'Too many sidebar project updates. Please try again shortly.',
          retryAfterSeconds: Math.ceil(result.timeToBlockExpire / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
