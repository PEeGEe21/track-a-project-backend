import { Injectable } from '@nestjs/common';
import {
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { config } from 'src/config';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redisService: RedisService,
    private readonly fallbackStorage: ThrottlerStorageService,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (config.rateLimit.driver !== 'redis') {
      return this.fallbackStorage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    const client = this.redisService.getClient();
    if (!client) {
      return this.fallbackStorage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    const baseKey = `${config.redis.prefix}:throttle:${throttlerName}:${key}`;
    const blockKey = `${baseKey}:blocked`;

    try {
      if (client.status === 'wait') {
        await client.connect();
      }

      const blockTtl = await client.pttl(blockKey);
      if (blockTtl > 0) {
        return {
          totalHits: limit,
          timeToExpire: blockTtl,
          isBlocked: true,
          timeToBlockExpire: blockTtl,
        };
      }

      const totalHits = await client.incr(baseKey);
      if (totalHits === 1) {
        await client.pexpire(baseKey, ttl);
      }

      const timeToExpire = Math.max(await client.pttl(baseKey), 0);
      const isBlocked = totalHits > limit;

      if (isBlocked) {
        await client.set(blockKey, '1', 'PX', blockDuration);
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire: isBlocked ? blockDuration : 0,
      };
    } catch {
      return this.fallbackStorage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }
}
