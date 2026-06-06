// src/whiteboard/whiteboard.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { WhiteboardsService } from './services/whiteboards.service';
import { v4 as uuidv4 } from 'uuid';
import { WebsocketRateLimiterService } from 'src/common/rate-limit/websocket-rate-limiter.service';
import { config } from 'src/config';

interface WhiteboardState {
  elements: any[];
  appState: any;
  files: any;
}

interface WhiteboardUpdatePayload {
  projectId: string;
  organizationId: string;
  userId: string;
  state: WhiteboardState;
  whiteboardId?: string;
  title?: string;
}

interface CursorUpdatePayload {
  projectId: string;
  whiteboardId?: string;
  userId: string;
  userName: string;
  pointer: { x: number; y: number };
}

interface TitleUpdatePayload {
  projectId?: string;
  whiteboardId: string;
  userId: string;
  organizationId: string;
  title: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: config.corsAllowedOrigins,
    credentials: true,
  },
  namespace: '/whiteboard',
})
export class WhiteboardsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WhiteboardsGateway.name);
  private activeUsers = new Map<string, Set<string>>(); // roomId -> Set of userIds

  private getRoomId(projectId?: string, whiteboardId?: string, userId?: string) {
    if (whiteboardId) {
      return `whiteboard-${whiteboardId}`;
    }

    if (projectId) {
      return `project-${projectId}`;
    }

    return `user-${userId}`;
  }

  constructor(
    private readonly whiteboardsService: WhiteboardsService,
    private readonly websocketRateLimiter: WebsocketRateLimiterService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId;
    const userName = client.handshake.auth?.userName;
    const projectId = client.handshake.query?.projectId as string | undefined;
    const organizationId = client.handshake.auth?.organizationId as string | undefined;

    this.logger.log(`Client attempting connection: ${client.id}`);

    if (!userId || !userName) {
      this.logger.warn(`Client ${client.id} missing auth data. Disconnecting.`);
      client.disconnect();
      return;
    }

    // Allow connecting without project
    client.data = { userId, userName, projectId: projectId || null, organizationId };

    this.logger.log(
      `Client connected: ${
        client.id
      } - User: ${userName} (${userId}) project: ${projectId ?? 'none'}`,
    );
  }

  async handleDisconnect(client: Socket) {
    const { userId, roomId } = client.data;

    if (roomId && userId) {
      const users = this.activeUsers.get(roomId);
      if (users) {
        users.delete(userId);
        if (users.size === 0) {
          this.activeUsers.delete(roomId);
        }
      }
    }
    client.removeAllListeners(); // 🧹 clean up

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('whiteboard:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      projectId?: string;
      userId: string;
      userName: string;
      whiteboardId?: string;
      organizationId: string
    },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'whiteboard:join');
    const { projectId, userId, userName, whiteboardId, organizationId } = data;

    // Create room ID
    const roomId = this.getRoomId(projectId, whiteboardId, userId);
    await client.join(roomId);
    client.data.roomId = roomId;

    // Track active users for project-based rooms
    if (!this.activeUsers.has(roomId)) {
      this.activeUsers.set(roomId, new Set());
    }
    this.activeUsers.get(roomId).add(userId);

    this.logger.log(
      `User ${userName} joined ${
        projectId ? 'project' : 'personal'
      } whiteboard (${roomId})`,
    );

    // ✅ Load initial state depending on mode
    let initialState;
    if (projectId) {
      // Project whiteboard
      initialState = await this.whiteboardsService.getWhiteboardState(
        organizationId,
        Number(projectId),
        whiteboardId,
      );
    } else {
      // Standalone whiteboard (per-user)
      initialState = (await this.whiteboardsService.getWhiteboardState(
        organizationId,
        null,
        whiteboardId,
      )) || {
        whiteboardId: whiteboardId || uuidv4(),
        elements: [],
        appState: {},
        files: {},
      };
    }

    // Send initial state to the joining client
    client.emit('whiteboard:initial-state', initialState);

    // Notify other clients in the same room (for projects)
    if (projectId) {
      client.to(roomId).emit('whiteboard:user-joined', {
        userId,
        userName,
        activeUsers: Array.from(this.activeUsers.get(roomId)),
      });
    }
  }

  @SubscribeMessage('whiteboard:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; userId: string; organizationId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'whiteboard:leave');
    const { projectId, userId } = data;
    const roomId = client.data.roomId || this.getRoomId(projectId, undefined, userId);

    await client.leave(roomId);

    const users = this.activeUsers.get(roomId);
    if (users) {
      users.delete(userId);
    }

    this.logger.log(`User ${userId} left whiteboard for project ${projectId}`);

    // Notify other users
    client.to(roomId).emit('whiteboard:user-left', {
      userId,
      activeUsers: users ? Array.from(users) : [],
    });
  }

  @SubscribeMessage('whiteboard:update')
  async handleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WhiteboardUpdatePayload,
  ) {
    await this.websocketRateLimiter.assertWithinLimit(
      client,
      'whiteboard:update',
      {
        limit: config.rateLimit.websocketBurstMax,
        ttlMs: config.rateLimit.websocketBurstWindowMs,
      },
    );
    const { projectId, userId, state, whiteboardId, title, organizationId } = payload;

    const roomId = this.getRoomId(projectId, whiteboardId, userId);

    client.to(roomId).emit('whiteboard:update', { ...state, title });

    await this.whiteboardsService.saveWhiteboardState(
      organizationId,
      projectId ? Number(projectId) : null,
      state,
      userId,
      whiteboardId,
      title,
    );
  }

  @SubscribeMessage('whiteboard:thumbnail')
  async handleThumbnail(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      whiteboardId: string;
      thumbnail: string;
      projectId?: number;
    },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(
      client,
      'whiteboard:thumbnail',
    );
    const { whiteboardId, thumbnail, projectId } = payload;

    try {
      // Save thumbnail to database
      await this.whiteboardsService.saveThumbnail(
        whiteboardId,
        thumbnail,
        projectId,
      );

      this.logger.log(`Thumbnail saved for whiteboard ${whiteboardId}`);
    } catch (error) {
      this.logger.error('Error saving thumbnail:', error);
    }
  }

  @SubscribeMessage('whiteboard:title-update')
  async handleTitleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TitleUpdatePayload,
  ) {
    await this.websocketRateLimiter.assertWithinLimit(
      client,
      'whiteboard:title-update',
    );
    const { projectId, whiteboardId, userId, title } = payload;

    const roomId = this.getRoomId(projectId, whiteboardId, userId);

    await this.whiteboardsService.updateWhiteboardTitle(
      whiteboardId,
      title,
      userId,
    );

    client.to(roomId).emit('whiteboard:title-update', { whiteboardId, title });

    this.logger.log(
      `Title updated for whiteboard ${whiteboardId} to "${title}" by user ${userId}`,
    );
  }

  @SubscribeMessage('whiteboard:cursor-update')
  async handleCursorUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CursorUpdatePayload,
  ) {
    await this.websocketRateLimiter.assertWithinLimit(
      client,
      'whiteboard:cursor-update',
      {
        limit: config.rateLimit.websocketBurstMax,
        ttlMs: config.rateLimit.websocketBurstWindowMs,
      },
    );
    const { projectId, whiteboardId, userId, userName, pointer } = payload;

    // Broadcast cursor position to other users (excluding sender)
    const roomId = this.getRoomId(projectId, whiteboardId, userId);

    client.to(roomId).emit('whiteboard:cursor-update', {
      userId,
      userName,
      pointer,
    });
  }
}
