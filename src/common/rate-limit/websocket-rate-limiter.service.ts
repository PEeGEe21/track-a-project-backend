import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { config } from 'src/config';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Injectable()
export class WebsocketRateLimiterService {
  constructor(private readonly storage: RedisThrottlerStorage) {}

  async assertWithinLimit(
    client: Socket,
    eventName: string,
    options?: {
      limit?: number;
      ttlMs?: number;
      blockDurationMs?: number;
    },
  ): Promise<void> {
    const limit = options?.limit ?? config.rateLimit.websocketMax;
    const ttlMs = options?.ttlMs ?? config.rateLimit.websocketWindowMs;
    const blockDurationMs = options?.blockDurationMs ?? ttlMs;
    const tracker =
      String(client.data?.userId ?? client.handshake.auth?.userId ?? client.id);
    const namespace = client.nsp?.name ?? 'socket';

    const result = await this.storage.increment(
      `${namespace}:${eventName}:${tracker}`,
      ttlMs,
      limit,
      blockDurationMs,
      'websocket',
    );

    if (result.isBlocked) {
      throw new WsException({
        message: `Rate limit exceeded for ${eventName}`,
        retryAfterSeconds: Math.ceil(result.timeToBlockExpire / 1000),
      });
    }
  }
}
