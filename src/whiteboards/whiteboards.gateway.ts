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

interface WhiteboardState {
  elements: any[];
  appState: any;
  files: any;
}

interface WhiteboardUpdatePayload {
  projectId: string;
  userId: string;
  state: WhiteboardState;
  whiteboardId?: string;
  title?: string;
}

interface CursorUpdatePayload {
  projectId: string;
  userId: string;
  userName: string;
  pointer: { x: number; y: number };
}

interface TitleUpdatePayload {
  projectId?: string;
  whiteboardId: string;
  userId: string;
  title: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
  private activeUsers = new Map<string, Set<string>>(); // projectId -> Set of userIds

  constructor(private readonly whiteboardsService: WhiteboardsService) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId;
    const userName = client.handshake.auth?.userName;
    const projectId = client.handshake.query?.projectId as string | undefined;

    this.logger.log(`Client attempting connection: ${client.id}`);

    if (!userId || !userName) {
      this.logger.warn(`Client ${client.id} missing auth data. Disconnecting.`);
      client.disconnect();
      return;
    }

    // Allow connecting without project
    client.data = { userId, userName, projectId: projectId || null };

    this.logger.log(
      `Client connected: ${
        client.id
      } - User: ${userName} (${userId}) project: ${projectId ?? 'none'}`,
    );
  }

  async handleDisconnect(client: Socket) {
    const { userId, projectId } = client.data;

    if (projectId && userId) {
      const users = this.activeUsers.get(projectId);
      if (users) {
        users.delete(userId);
        if (users.size === 0) {
          this.activeUsers.delete(projectId);
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
    },
  ) {
    const { projectId, userId, userName, whiteboardId } = data;

    // Create room ID
    const roomId = projectId ? `project-${projectId}` : `user-${userId}`;
    await client.join(roomId);

    // Track active users for project-based rooms
    if (projectId) {
      if (!this.activeUsers.has(projectId)) {
        this.activeUsers.set(projectId, new Set());
      }
      this.activeUsers.get(projectId).add(userId);
    }

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
        Number(projectId),
      );
    } else {
      // Standalone whiteboard (per-user)
      initialState = (await this.whiteboardsService.getWhiteboardState(
        null,
        whiteboardId,
      )) || {
        whiteboardId: whiteboardId || uuidv4(),
        elements: [],
        appState: {},
        files: {},
      };
    }

    // console.log(initialState, 'initial state');

    // Send initial state to the joining client
    client.emit('whiteboard:initial-state', initialState);

    // Notify other clients in the same room (for projects)
    if (projectId) {
      client.to(roomId).emit('whiteboard:user-joined', {
        userId,
        userName,
        activeUsers: Array.from(this.activeUsers.get(projectId)),
      });
    }
  }

  @SubscribeMessage('whiteboard:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; userId: string },
  ) {
    const { projectId, userId } = data;

    await client.leave(`project-${projectId}`);

    const users = this.activeUsers.get(projectId);
    if (users) {
      users.delete(userId);
    }

    this.logger.log(`User ${userId} left whiteboard for project ${projectId}`);

    // Notify other users
    client.to(`project-${projectId}`).emit('whiteboard:user-left', {
      userId,
      activeUsers: users ? Array.from(users) : [],
    });
  }

  @SubscribeMessage('whiteboard:update')
  async handleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WhiteboardUpdatePayload,
  ) {
    const { projectId, userId, state, whiteboardId, title } = payload;

    const roomId = projectId ? `project-${projectId}` : `user-${userId}`;

    client.to(roomId).emit('whiteboard:update', { ...state, title });

    await this.whiteboardsService.saveWhiteboardState(
      projectId ? Number(projectId) : null,
      state,
      userId,
      whiteboardId,
      title,
    );
    console.log(payload, 'payloadpayload2');
    // Only persist if tied to a project
    // if (projectId) {
    //   await this.whiteboardsService.saveWhiteboardState(
    //     Number(projectId),
    //     state,
    //     userId,
    //     whiteboardId,
    //   );
    //   client.to(`project-${projectId}`).emit('whiteboard:update', state);
    // } else {
    //   await this.whiteboardsService.saveWhiteboardState(
    //     null,
    //     state,
    //     userId,
    //     whiteboardId,
    //   );
    //   // Broadcast to user’s own room (if standalone board)
    //   client.to(`user-${userId}`).emit('whiteboard:update', state);
    // }
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
    const { projectId, whiteboardId, userId, title } = payload;

    const roomId = projectId
      ? `project-${projectId}`
      : `whiteboard-${whiteboardId}`;

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
  handleCursorUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CursorUpdatePayload,
  ) {
    const { projectId, userId, userName, pointer } = payload;

    // Broadcast cursor position to other users (excluding sender)
    client.to(`project-${projectId}`).emit('whiteboard:cursor-update', {
      userId,
      userName,
      pointer,
    });
  }
}
