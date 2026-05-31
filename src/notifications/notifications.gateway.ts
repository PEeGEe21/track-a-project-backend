// notifications.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { WebsocketRateLimiterService } from 'src/common/rate-limit/websocket-rate-limiter.service';
import { config } from 'src/config';

// IMPORTANT: No namespace is specified in the decorator
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notification',
  // Default Socket.IO path is '/socket.io' - only change if needed
  // path: '/socket.io/',
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private users: Map<string, string> = new Map(); // userId -> socketId
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly websocketRateLimiter: WebsocketRateLimiterService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // You can send an initial message if needed
    client.emit('connection_status', {
      status: 'connected',
      socketId: client.id,
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove user from the map
    let removedUserId = null;
    for (const [userId, socketId] of this.users.entries()) {
      if (socketId === client.id) {
        this.users.delete(userId);
        removedUserId = userId;
        this.logger.log(`User ${userId} unregistered due to disconnect`);
        break;
      }
    }

    return { status: 'disconnected', userId: removedUserId };
  }

  @SubscribeMessage('register')
  async handleRegister(client: Socket, userId: string) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'register', {
      limit: config.rateLimit.authMax,
      ttlMs: config.rateLimit.authWindowMs,
    });
    if (!userId) {
      this.logger.error('Registration attempt with null/undefined userId');
      throw new WsException('User ID is required for registration');
    }

    this.logger.log(`User ${userId} registered with socket ${client.id}`);

    // Store the socket ID for this user
    this.users.set(userId, client.id);

    // Have the client join a room named after their user ID
    client.join(`user_${userId}`);

    // Send confirmation to the client
    client.emit('register_confirm', {
      status: 'registered',
      userId,
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });

    return { status: 'registered', userId };
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(client: Socket, data: any) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'heartbeat', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });
    // Find which user this socket belongs to
    let foundUserId = null;
    for (const [userId, socketId] of this.users.entries()) {
      if (socketId === client.id) {
        foundUserId = userId;
        break;
      }
    }

    // Log heartbeat (use debug level to avoid cluttering logs)
    this.logger.debug(
      `Heartbeat from socket ${client.id}, user: ${foundUserId || 'unknown'}`,
    );

    // Send acknowledgment back to client
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      userId: foundUserId,
    };
  }

  // Send notification to a specific user
  sendNotificationToUser(userId: string, notification: any) {
    if (!userId) {
      this.logger.error(
        'Attempted to send notification to null/undefined userId',
      );
      return false;
    }

    this.logger.log(`Sending notification to user ${userId}`);

    // Method 1: Using the Map
    const socketId = this.users.get(userId);
    if (socketId) {
      this.logger.log(`Found socket ${socketId} for user ${userId}`);
      this.server.to(socketId).emit('notification', notification);
      return true;
    }

    // Method 2: Using rooms (as backup and for multiple connections)
    this.logger.log(
      `No direct socket found for user ${userId}, trying room broadcast`,
    );

    this.server.to(`user_${userId}`).emit('notification', notification);

    // We don't know if anyone is in the room, but we tried
    return true;
  }

  // Send notification to all connected clients
  sendNotificationToAll(notification: any) {
    this.logger.log('Broadcasting notification to all users');
    this.server.emit('notification', notification);
    return true;
  }
}
