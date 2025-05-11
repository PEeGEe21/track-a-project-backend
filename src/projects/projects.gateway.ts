import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from "@nestjs/websockets"
import { type Server, Socket } from "socket.io"
import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common"
import { ProjectsService } from "./services/projects.service"

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
@Injectable()
export class ProjectsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ProjectsGateway.name);
  private users: Map<string, string> = new Map(); // userId -> socketId
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId
  private projectRooms: Map<string, Set<string>> = new Map(); // projectId -> Set of userIds

  constructor(
    @Inject(forwardRef(() => ProjectsService)) private projectService: ProjectsService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connection_status', {
      status: 'connected',
      socketId: client.id,
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: $client.id`);

    // Get userId from socketId
    const userId = this.socketToUser.get(client.id);
    
    // Clean up maps
    if (userId) {
      this.users.delete(userId);
      this.socketToUser.delete(client.id);
      
      // Remove user from project rooms
      for (const [projectId, users] of this.projectRooms.entries()) {
        if (users.has(userId)) {
          users.delete(userId);
          this.logger.log(`User $userIdremoved from project $projectIddue to disconnect`);
        }
      }
      
      this.logger.log(`User $userIdunregistered due to disconnect`);
    }

    return { status: 'disconnected', userId };
  }

  @SubscribeMessage('register')
  async handleRegister(client: Socket, userId: string) {
    if (!userId) {
      throw new WsException('User ID is required');
    }

    this.logger.log(`User $userIdregistered with socket $client.id`);
    
    // Store the mapping in both directions
    this.users.set(userId, client.id);
    this.socketToUser.set(client.id, userId);

    // Join personal room
    client.join(`user_$userId`);

    // Auto-join project rooms user is part of
    const projectIds = await this.projectService.getProjectsForUser({ userId });
    projectIds.forEach((projectId) => {
      this.joinProjectRoom(client, userId, projectId);
    });

    client.emit('register_confirm', {
      status: 'registered',
      userId,
      socketId: client.id,
      projects: projectIds,
    });

    return { status: 'registered', userId };
  }

  @SubscribeMessage('join_project')
  handleJoinProject(client: Socket, projectId: string | number) {
    const userId = this.socketToUser.get(client.id);
    if (!userId) {
      this.logger.warn(`Socket $client.idtried to join project $projectIdbut is not registered`);
      return { status: 'error', message: 'User not registered' };
    }

    this.joinProjectRoom(client, userId, projectId);
    return { status: 'joined', projectId };
  }

  @SubscribeMessage('leave_project')
  handleLeaveProject(client: Socket, projectId: string | number) {
    const userId = this.socketToUser.get(client.id);
    if (!userId) {
      return { status: 'error', message: 'User not registered' };
    }

    // Leave the socket.io room
    client.leave(`project_$projectId`);
    
    // Update our tracking
    const projectRoom = this.projectRooms.get(String(projectId));
    if (projectRoom) {
      projectRoom.delete(userId);
    }
    
    this.logger.log(`User $userIdleft project room: project_$projectId`);
    return { status: 'left', projectId };
  }

  private joinProjectRoom(client: Socket, userId: string, projectId: string | number) {
    // Join the socket.io room
    client.join(`project_$projectId`);
    
    // Track in our map
    const projectIdStr = String(projectId);
    if (!this.projectRooms.has(projectIdStr)) {
      this.projectRooms.set(projectIdStr, new Set());
    }
    this.projectRooms.get(projectIdStr)?.add(userId);
    
    this.logger.log(`User $userIdjoined project room: project_$projectId`);
  }

  @SubscribeMessage('new_comment')
  async handleNewComment(client: Socket, payload) {
    // Extract projectId from payload
    const projectId = payload.projectId;
    if (!projectId) {
      this.logger.warn('Received new_comment without projectId', payload);
      return { status: 'error', message: 'projectId is required' };
    }

    this.logger.log(`Broadcasting new comment to project_$projectId`, { 
      roomSize: this.server.sockets.adapter.rooms.get(`project_$projectId`)?.size || 0 
    });

    // Ensure the payload has a consistent format
    const commentPayload = payload.comment ? payload : { 
      projectId, 
      comment: payload 
    };

    // Broadcast to ALL clients in the project room INCLUDING the sender
    this.server.to(`project_$projectId`).emit('new_comment', commentPayload);
    
    return { status: 'sent', projectId };
  }

  @SubscribeMessage('add_reaction')
  async handleAddReaction(
    client: Socket,
    payload: {
      projectId: string;
      messageId: string;
      userId: string;
      emoji: string;
    },
  ) {
    const { projectId, messageId, userId, emoji } = payload;
    if (!projectId || !messageId || !userId || !emoji) return;

    // Call the service with the user object structure it expects
    await this.projectService.addReaction({ userId }, messageId, emoji);

    // Broadcast to project
    this.server.to(`project_$projectId`).emit('reaction_added', {
      projectId,
      messageId,
      userId,
      emoji,
    });
  }

  @SubscribeMessage('typing')
  async handleTyping(client: Socket, payload: { projectId: string; userId: string }) {
    const { projectId, userId } = payload;
    if (!projectId || !userId) return;

    const user = await this.projectService.getUserAccountById(userId);


    // Broadcast to project room (except sender)
    client.to(`project_$projectId`).emit('user_typing', {
      projectId,
      user,
    });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    client: Socket,
    payload: { projectId: string; userId: string },
  ) {
    const { projectId, userId } = payload;
    if (!projectId || !userId) return;

    client.to(`project_$projectId`).emit('user_stop_typing', {
      projectId,
      userId,
    });
  }

  @SubscribeMessage('get_project_messages')
  async handleGetProjectMessages(
    client: Socket,
    payload: { projectId: string; userId: string },
  ) {
    const { projectId, userId } = payload;
    if (!projectId || !userId) {
      throw new WsException('projectId and userId required');
    }

    const result = await this.projectService.getProjectComments(
      { userId },
      Number(projectId),
    );

    if (!result) {
      client.emit('error', { message: 'Failed to get project comments' });
      return;
    }

    client.emit('project_message_history', {
      projectId,
      messages: result.comments,
    });
  }

  // Send notification to a specific user
  sendNotificationToUser(userId: string, notification: any) {
    if (!userId) {
      this.logger.error(
        'Attempted to send notification to null/undefined userId',
      );
      return false;
    }

    this.logger.log(`Sending notification to user $userId`);

    // Method 1: Using the Map
    const socketId = this.users.get(userId);
    if (socketId) {
      this.logger.log(`Found socket $socketIdfor user ${userId}`);
      this.server.to(socketId).emit('notification', notification);
      return true;
    }

    // Method 2: Using rooms (as backup and for multiple connections)
    this.logger.log(
      `No direct socket found for user ${userId}, trying room broadcast`,
    );
    this.server.to(`user_$userId`).emit('notification', notification);

    // We don't know if anyone is in the room, but we tried
    return true;
  }

  // Debug method to get active connections
  getActiveConnections() {
    return {
      totalSockets: this.server.sockets.sockets.size,
      registeredUsers: Object.fromEntries(this.users),
      projectRooms: Object.fromEntries(
        Array.from(this.projectRooms.entries()).map(([projectId, users]) => [
          projectId,
          Array.from(users),
        ])
      ),
    };
  }
}


// // projects.gateway.ts
// import {
//   WebSocketGateway,
//   WebSocketServer,
//   SubscribeMessage,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   OnGatewayInit,
//   WsException,
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
// import { ProjectsService } from './services/projects.service';

// @WebSocketGateway({
//   cors: {
//     origin: process.env.FRONTEND_URL || 'http://localhost:3000',
//     credentials: true,
//   },
// })
// @Injectable()
// export class ProjectsGateway
//   implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
// {
//   @WebSocketServer()
//   server: Server;

//   private readonly logger = new Logger(ProjectsGateway.name);
//   private users: Map<string, string> = new Map(); // userId -> socketId

//   // Properly inject the ProjectsService
//   constructor(
//     // private readonly projectService: ProjectsService
//     @Inject(forwardRef(() => ProjectsService)) private projectService: ProjectsService,
//   ) {}

//   afterInit(server: Server) {
//     this.logger.log('WebSocket Gateway initialized');
//   }

//   handleConnection(client: Socket) {
//     this.logger.log(`Client connected: ${client.id}`);
//     client.emit('connection_status', {
//       status: 'connected',
//       socketId: client.id,
//     });
//   }

//   handleDisconnect(client: Socket) {
//     this.logger.log(`Client disconnected: ${client.id}`);

//     // Remove user from the map
//     let removedUserId = null;
//     for (const [userId, socketId] of this.users.entries()) {
//       if (socketId === client.id) {
//         this.users.delete(userId);
//         removedUserId = userId;
//         this.logger.log(`User ${userId} unregistered due to disconnect`);
//         break;
//       }
//     }

//     return { status: 'disconnected', userId: removedUserId };
//   }

//   @SubscribeMessage('register')
//   async handleRegister(client: Socket, userId: string) {
//     if (!userId) {
//       throw new WsException('User ID is required');
//     }

//     this.logger.log(`User ${userId} registered with socket ${client.id}`);
//     this.users.set(userId, client.id);

//     // Join personal room
//     client.join(`user_${userId}`);

//     // Auto-join project rooms user is part of
//     const projectIds = await this.projectService.getProjectsForUser({ userId });
//     projectIds.forEach((projectId) => {
//       client.join(`project_${projectId}`);
//       this.logger.log(
//         `User ${userId} joined project room: project_${projectId}`,
//       );
//     });

//     client.emit('register_confirm', {
//       status: 'registered',
//       userId,
//       socketId: client.id,
//       projects: projectIds,
//     });

//     return { status: 'registered', userId };
//   }
//   // Implement the missing method
//   // private async getProjectsForUser(userId: string): Promise<string[]> {
//   //   try {
//   //     const projects = await this.projectService.getUserProjects(userId);
//   //     return projects.map((project) => project.id);
//   //   } catch (error) {
//   //     this.logger.error(`Failed to get projects for user ${userId}:`, error);
//   //     return [];
//   //   }
//   // }

//   @SubscribeMessage('add_reaction')
//   async handleAddReaction(
//     client: Socket,
//     payload: {
//       projectId: string;
//       messageId: string;
//       userId: string;
//       emoji: string;
//     },
//   ) {
//     const { projectId, messageId, userId, emoji } = payload;
//     if (!projectId || !messageId || !userId || !emoji) return;

//     // Call the service with the user object structure it expects
//     await this.projectService.addReaction({ userId }, messageId, emoji);

//     // Broadcast to project
//     this.server.to(`project_${projectId}`).emit('reaction_added', {
//       projectId,
//       messageId,
//       userId,
//       emoji,
//     });
//   }

//   @SubscribeMessage('mark_seen')
//   async handleMarkSeen(
//     client: Socket,
//     payload: { projectId: string; userId: string; messageIds: string[] },
//   ) {
//     const { projectId, userId, messageIds } = payload;
//     if (!projectId || !userId || !messageIds?.length) return;

//     // Check if service method exists; if not, log a warning
//     if (typeof this.projectService.markMessagesSeen !== 'function') {
//       this.logger.warn(
//         'markMessagesSeen method is not implemented in ProjectsService',
//       );
//     } else {
//       await this.projectService.markMessagesSeen({ userId }, messageIds);
//     }

//     // Notify other users in project room regardless of service call
//     client.to(`project_${projectId}`).emit('messages_seen', {
//       projectId,
//       userId,
//       messageIds,
//     });
//   }

//   @SubscribeMessage('typing')
//   handleTyping(client: Socket, payload: { projectId: string; userId: string }) {
//     const { projectId, userId } = payload;
//     if (!projectId || !userId) return;

//     // Broadcast to project room (except sender)
//     client.to(`project_${projectId}`).emit('user_typing', {
//       projectId,
//       userId,
//     });
//   }

//   @SubscribeMessage('stop_typing')
//   handleStopTyping(
//     client: Socket,
//     payload: { projectId: string; userId: string },
//   ) {
//     const { projectId, userId } = payload;
//     if (!projectId || !userId) return;

//     client.to(`project_${projectId}`).emit('user_stop_typing', {
//       projectId,
//       userId,
//     });
//   }

//   @SubscribeMessage('get_project_messages')
//   async handleGetProjectMessages(
//     client: Socket,
//     payload: { projectId: string; userId: string },
//   ) {
//     const { projectId, userId } = payload;
//     if (!projectId || !userId) {
//       throw new WsException('projectId and userId required');
//     }

//     const result = await this.projectService.getProjectComments(
//       { userId },
//       Number(projectId),
//     );

//     if (!result) {
//       client.emit('error', { message: 'Failed to get project comments' });
//       return;
//     }

//     client.emit('project_message_history', {
//       projectId,
//       messages: result.comments,
//     });
//   }

//   // Somewhere in your ProjectsGateway
//   @SubscribeMessage('new_comment')
//   async handleNewComment(client: Socket, payload) {
//     // Save comment if needed (if REST not already doing it) — in your case REST handles saving

//     console.log("new_comment", payload,  "dccqcqcqwwc")
//     // Broadcast to project room
//     this.server.to(`project_${payload.projectId}`).emit('new_comment', payload);
//   }

//   // @SubscribeMessage('heartbeat')
//   // handleHeartbeat(client: Socket, data: any) {
//   //   // Find which user this socket belongs to
//   //   let foundUserId = null;
//   //   for (const [userId, socketId] of this.users.entries()) {
//   //     if (socketId === client.id) {
//   //       foundUserId = userId;
//   //       break;
//   //     }
//   //   }

//   //   // Log heartbeat (use debug level to avoid cluttering logs)
//   //   this.logger.debug(
//   //     `Heartbeat from socket ${client.id}, user: ${foundUserId || 'unknown'}`,
//   //   );

//   //   // Send acknowledgment back to client
//   //   return {
//   //     status: 'ok',
//   //     timestamp: new Date().toISOString(),
//   //     userId: foundUserId,
//   //   };
//   // }

//   // Send notification to a specific user
//   sendNotificationToUser(userId: string, notification: any) {
//     if (!userId) {
//       this.logger.error(
//         'Attempted to send notification to null/undefined userId',
//       );
//       return false;
//     }

//     this.logger.log(`Sending notification to user ${userId}`);

//     // Method 1: Using the Map
//     const socketId = this.users.get(userId);
//     if (socketId) {
//       this.logger.log(`Found socket ${socketId} for user ${userId}`);
//       this.server.to(socketId).emit('notification', notification);
//       return true;
//     }

//     // Method 2: Using rooms (as backup and for multiple connections)
//     this.logger.log(
//       `No direct socket found for user ${userId}, trying room broadcast`,
//     );
//     this.server.to(`user_${userId}`).emit('notification', notification);

//     // We don't know if anyone is in the room, but we tried
//     return true;
//   }

//   // Send notification to all connected clients
//   sendNotificationToAll(notification: any) {
//     this.logger.log('Broadcasting notification to all users');
//     this.server.emit('notification', notification);
//     return true;
//   }
// }
