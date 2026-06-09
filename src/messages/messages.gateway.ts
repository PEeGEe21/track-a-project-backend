// messages.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { WebsocketRateLimiterService } from 'src/common/rate-limit/websocket-rate-limiter.service';
import { config } from 'src/config';
import { RedisService } from 'src/redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: config.corsAllowedOrigins,
    credentials: true,
  },
  namespace: '/messages', // Different namespace
})
@Injectable()
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private onlineUsers: Map<number, Set<string>> = new Map(); // userId -> socketIds
  private userSockets: Map<string, number> = new Map(); // socketId -> userId
  private readonly logger = new Logger(MessagesGateway.name);
  private readonly presenceTtlSeconds = 90;

  constructor(
    private readonly websocketRateLimiter: WebsocketRateLimiterService,
    private readonly redisService: RedisService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Messages WebSocket Gateway initialized');
  }

  handleConnection(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client connected to messages: ${client.id}`);

    client.emit('connection_status', {
      status: 'connected',
      socketId: client.id,
    });
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = this.userSockets.get(client.id);

    if (userId) {
      this.userSockets.delete(client.id);
      const currentSockets = this.onlineUsers.get(userId);
      if (currentSockets) {
        currentSockets.delete(client.id);
        if (currentSockets.size === 0) {
          this.onlineUsers.delete(userId);
        }
      }

      const stillOnline = await this.unregisterPresence(userId, client.id);

      if (!stillOnline) {
        this.logger.log(`User ${userId} went offline`);
        this.server.emit('user_status_changed', {
          userId,
          online: false,
          timestamp: new Date().toISOString(),
        });
      }
    }

    this.logger.log(`Client disconnected from messages: ${client.id}`);
  }

  @SubscribeMessage('register_user')
  async handleRegisterUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'register_user', {
      limit: config.rateLimit.authMax,
      ttlMs: config.rateLimit.authWindowMs,
    });
    const { userId } = data;

    if (!userId) {
      throw new WsException('User ID is required');
    }

    this.logger.log(
      `User ${userId} registered for messaging with socket ${client.id}`,
    );

    const wasOnline = await this.isUserOnline(userId);

    const socketIds = this.onlineUsers.get(userId) ?? new Set<string>();
    socketIds.add(client.id);
    this.onlineUsers.set(userId, socketIds);
    this.userSockets.set(client.id, userId);

    // Join user-specific room
    client.join(`user_${userId}`);

    await this.registerPresence(userId, client.id);

    if (!wasOnline) {
      this.server.emit('user_status_changed', {
        userId,
        online: true,
        timestamp: new Date().toISOString(),
      });
    }

    client.emit('register_confirm', {
      status: 'registered',
      userId,
      socketId: client.id,
    });

    return { status: 'registered', userId };
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'heartbeat', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });
    const userId = this.userSockets.get(client.id);

    if (userId) {
      await this.registerPresence(userId, client.id);
    }

    return {
      status: 'ok',
      userId: userId ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(
      client,
      'join_conversation',
    );
    const { conversationId } = data;
    const userId = this.userSockets.get(client.id);

    if (!conversationId) {
      throw new WsException('Conversation ID is required');
    }

    this.logger.log(`User ${userId} joining conversation ${conversationId}`);

    client.join(`conversation_${conversationId}`);

    return {
      status: 'joined',
      conversationId,
      userId,
    };
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(
      client,
      'leave_conversation',
    );
    const { conversationId } = data;
    const userId = this.userSockets.get(client.id);

    this.logger.log(`User ${userId} leaving conversation ${conversationId}`);

    client.leave(`conversation_${conversationId}`);

    return {
      status: 'left',
      conversationId,
      userId,
    };
  }

  //   @SubscribeMessage('typing_start')
  //   handleTypingStart(
  //     @ConnectedSocket() client: Socket,
  //     @MessageBody() data: { conversationId: string },
  //   ) {
  //     const { conversationId } = data;
  //     const userId = this.userSockets.get(client.id);

  //     if (!userId || !conversationId) return;

  //     this.logger.debug(`User ${userId} started typing in ${conversationId}`);

  //     // Broadcast to everyone in the conversation EXCEPT the sender
  //     client.to(`conversation_${conversationId}`).emit('user_typing', {
  //       conversationId,
  //       userId,
  //       isTyping: true,
  //     });

  //     return { status: 'sent' };
  //   }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'typing_stop', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketBurstWindowMs,
    });
    const { conversationId } = data;
    const userId = this.userSockets.get(client.id);

    if (!userId || !conversationId) return;

    this.logger.debug(`User ${userId} stopped typing in ${conversationId}`);

    client.to(`conversation_${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      isTyping: false,
    });

    return { status: 'sent' };
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'message_read');
    const { conversationId, messageId } = data;
    const userId = this.userSockets.get(client.id);

    if (!userId || !conversationId || !messageId) return;

    this.logger.log(`User ${userId} read message ${messageId}`);

    // Notify others in the conversation
    client.to(`conversation_${conversationId}`).emit('message_read_receipt', {
      conversationId,
      messageId,
      userId,
      readAt: new Date().toISOString(),
    });

    return { status: 'sent' };
  }

  // Called from your MessagesService when a new message is sent
  notifyNewMessage(conversationId: string, message: any) {
    this.logger.log(
      `Broadcasting new message to conversation ${conversationId}`,
    );
    // Send to everyone in the conversation
    this.server.to(`conversation_${conversationId}`).emit('new_message', {
      conversationId,
      message,
    });
  }

  // Notify specific user about new conversation
  notifyNewConversation(userId: number, conversation: any) {
    const socketIds = this.onlineUsers.get(userId);

    if (socketIds?.size) {
      this.logger.log(`Notifying user ${userId} about new conversation`);
      this.server.to(`user_${userId}`).emit('new_conversation', conversation);
    } else {
      this.logger.log(
        `User ${userId} is offline, cannot notify about new conversation`,
      );
    }
  }

  notifyReactionAdded(conversationId: string, payload: any) {
    this.server.to(`conversation_${conversationId}`).emit('message_reaction_added', {
      conversationId,
      ...payload,
    });
  }

  notifyReactionRemoved(conversationId: string, payload: any) {
    this.server
      .to(`conversation_${conversationId}`)
      .emit('message_reaction_removed', {
        conversationId,
        ...payload,
      });
  }

  // Check if user is online
  async isUserOnline(userId: number): Promise<boolean> {
    const client = await this.redisService.getConnectedClient().catch(() => null);
    if (client) {
      const key = this.getPresenceKey(userId);
      const count = await client.scard(key).catch(() => 0);
      return count > 0;
    }

    return (this.onlineUsers.get(userId)?.size ?? 0) > 0;
  }

  // Get all online users
  async getOnlineStatusMap(userIds: number[]): Promise<Map<number, boolean>> {
    const statusMap = new Map<number, boolean>();
    const uniqueIds = [...new Set(userIds)];
    const client = await this.redisService.getConnectedClient().catch(() => null);

    if (client) {
      await Promise.all(
        uniqueIds.map(async (userId) => {
          const count = await client.scard(this.getPresenceKey(userId)).catch(() => 0);
          statusMap.set(userId, count > 0);
        }),
      );
      return statusMap;
    }

    uniqueIds.forEach((userId) => {
      statusMap.set(userId, (this.onlineUsers.get(userId)?.size ?? 0) > 0);
    });

    return statusMap;
  }

  // messages.gateway.ts – add typing broadcast to the *sender* as well (so UI can show own typing)
  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'typing_start', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketBurstWindowMs,
    });
    const userId = this.userSockets.get(client.id);
    if (!userId || !data.conversationId) return;
    this.server.to(`conversation_${data.conversationId}`).emit('user_typing', {
      conversationId: data.conversationId,
      userId,
      isTyping: true,
    });
  }

  private getPresenceKey(userId: number) {
    return `${config.redis.prefix}:chat:presence:user:${userId}:sockets`;
  }

  private async registerPresence(userId: number, socketId: string) {
    const client = await this.redisService.getConnectedClient().catch(() => null);
    if (!client) {
      return;
    }

    const key = this.getPresenceKey(userId);
    await client.sadd(key, socketId);
    await client.expire(key, this.presenceTtlSeconds);
  }

  private async unregisterPresence(userId: number, socketId: string) {
    const client = await this.redisService.getConnectedClient().catch(() => null);
    if (!client) {
      return (this.onlineUsers.get(userId)?.size ?? 0) > 0;
    }

    const key = this.getPresenceKey(userId);
    await client.srem(key, socketId);
    const remainingConnections = await client.scard(key);
    if (remainingConnections === 0) {
      await client.del(key);
      return false;
    }

    await client.expire(key, this.presenceTtlSeconds);
    return true;
  }
}
