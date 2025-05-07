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

// IMPORTANT: No namespace is specified in the decorator
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
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
  handleRegister(client: Socket, userId: string) {
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
  handleHeartbeat(client: Socket, data: any) {
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

    console.log('in sending notifications')
    this.logger.log(`Sending notification to user ${userId}`);

    // Method 1: Using the Map
    const socketId = this.users.get(userId);
    console.log(socketId, 'socketId')
    if (socketId) {
      this.logger.log(`Found socket ${socketId} for user ${userId}`);
      this.server.to(socketId).emit('notification', notification);
      return true;
    }

    console.log(socketId, 'socketId2')

    // Method 2: Using rooms (as backup and for multiple connections)
    this.logger.log(
      `No direct socket found for user ${userId}, trying room broadcast`,
    );
    console.log(socketId, 'socketId3')

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

// // SERVER SIDE (NestJS)
// import {
//   WebSocketGateway,
//   WebSocketServer,
//   SubscribeMessage,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   OnGatewayInit,
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { Injectable, Logger } from '@nestjs/common';

// @WebSocketGateway({
//   cors: {
//     origin: '*',
//     // origin: process.env.FRONTEND_URL || 'http://localhost:3000',
//     // credentials: true,
//   },
// })
// @Injectable()
// export class NotificationsGateway
//   implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
// {
//   @WebSocketServer()
//   server: Server;

//   private users: Map<string, string> = new Map(); // userId -> socketId
//   private readonly logger = new Logger(NotificationsGateway.name);

//   afterInit(server: Server) {
//     this.logger.log('WebSocket Gateway initialized');
//   }

//   handleConnection(client: Socket) {
//     this.logger.log(`Client connected: ${client.id}`);
//   }

//   handleDisconnect(client: Socket) {
//     this.logger.log(`Client disconnected: ${client.id}`);
//     // Remove user from the map
//     for (const [userId, socketId] of this.users.entries()) {
//       if (socketId === client.id) {
//         this.users.delete(userId);
//         this.logger.log(`User ${userId} unregistered`);
//         break;
//       }
//     }
//   }

//   @SubscribeMessage('register')
//   handleRegister(client: Socket, userId: string) {
//     this.logger.log(`User ${userId} registered with socket ${client.id}`);

//     // Store the socket ID for this user
//     this.users.set(userId, client.id);

//     // Have the client join a room named after their user ID
//     client.join(`user_${userId}`);

//     return { status: 'registered' };
//   }

//   // Send notification to a specific user
//   sendNotificationToUser(userId: string, notification: any) {
//     this.logger.log(`Sending notification to user ${userId}`);

//     // Method 1: Using the Map
//     const socketId = this.users.get(userId);
//     if (socketId) {
//       this.logger.log(`Found socket ${socketId} for user ${userId}`);
//       this.server.to(socketId).emit('notification', notification);
//     } else {
//       this.logger.warn(`No socket found for user ${userId}`);
//     }

//     // Method 2: Using rooms (more reliable)
//     this.server.to(`user_${userId}`).emit('notification', notification);
//   }

//   // Send notification to all connected clients
//   sendNotificationToAll(notification: any) {
//     this.logger.log('Broadcasting notification to all users');
//     this.server.emit('notification', notification);
//   }
// }

// import {
//   WebSocketGateway,
//   WebSocketServer,
//   SubscribeMessage,
//   OnGatewayConnection,
//   OnGatewayDisconnect
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { Injectable } from '@nestjs/common';

// @WebSocketGateway({
//   cors: {
//     origin: '*', // In production, set this to your frontend URL
//   },
// })
// @Injectable()
// export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
//   @WebSocketServer()
//   server: Server;

//   private users: Map<string, string> = new Map(); // userId -> socketId

//   handleConnection(client: Socket) {
//     console.log(`Client connected: ${client.id}`);
//   }

//   notifyUser(userId: number, notification: Notification) {
//     this.server.to(`user_${userId}`).emit('notification', notification);
//   }

//   handleDisconnect(client: Socket) {
//     console.log(`Client disconnected: ${client.id}`);
//     // Remove user from the map
//     for (const [userId, socketId] of this.users.entries()) {
//       if (socketId === client.id) {
//         this.users.delete(userId);
//         break;
//       }
//     }
//   }

//   @SubscribeMessage('register')
//   handleRegister(client: Socket, userId: string) {
//     this.users.set(userId, client.id);
//     console.log(`User ${userId} registered with socket ${client.id}`);
//   }

//   // Send notification to a specific user
//   sendNotificationToUser(userId: string, notification: any) {
//     const socketId = this.users.get(userId);
//     console.log(socketId, 'socket id')
//     if (socketId) {
//       this.server.to(socketId).emit('notification', notification);
//     }
//   }

//   // Send notification to all connected clients
//   sendNotificationToAll(notification: any) {
//     this.server.emit('notification', notification);
//   }
// }
