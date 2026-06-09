import {
  Injectable,
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { config } from 'src/config';

@Injectable()
export class RedisService implements OnModuleDestroy, OnApplicationShutdown {
  private client: Redis | null = null;

  isEnabled(): boolean {
    return config.redis.enabled && Boolean(config.redis.url);
  }

  getClient(): Redis | null {
    if (!this.isEnabled()) {
      return null;
    }

    if (!this.client) {
      this.client = new Redis(config.redis.url as string, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    }

    return this.client;
  }

  async getConnectedClient(): Promise<Redis | null> {
    const client = this.getClient();
    if (!client) {
      return null;
    }

    if (client.status === 'wait') {
      await client.connect();
    }

    return client;
  }

  async ping(): Promise<{
    enabled: boolean;
    configured: boolean;
    reachable: boolean;
    status: string;
  }> {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        configured: false,
        reachable: false,
        status: 'disabled',
      };
    }

    const client = this.getClient();
    if (!client) {
      return {
        enabled: true,
        configured: true,
        reachable: false,
        status: 'unavailable',
      };
    }

    try {
      if (client.status === 'wait') {
        await client.connect();
      }

      await client.ping();
      return {
        enabled: true,
        configured: true,
        reachable: true,
        status: client.status,
      };
    } catch {
      return {
        enabled: true,
        configured: true,
        reachable: false,
        status: client.status,
      };
    }
  }

  getBullConnection():
    | {
        host: string;
        port: number;
        username?: string;
        password?: string;
        tls?: Record<string, never>;
      }
    | null {
    if (!this.isEnabled() || !config.redis.url) {
      return null;
    }

    const parsed = new URL(config.redis.url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async onApplicationShutdown() {
    await this.disconnect();
  }

  private async disconnect() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }
}
