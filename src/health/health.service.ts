import { Injectable } from '@nestjs/common';
import { config } from 'src/config';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(private readonly redisService: RedisService) {}

  async getHealth() {
    const redis = await this.redisService.ping();

    return {
      status: 'ok',
      service: 'track-a-project-backend',
      environment: process.env.NODE_ENV ?? 'unknown',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      docsUrl: '/api/docs',
      infrastructure: {
        redis,
        rateLimitDriver: config.rateLimit.driver,
        queueDriver: config.queue.driver,
      },
    };
  }
}
