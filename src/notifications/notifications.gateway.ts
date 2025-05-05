import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, set this to your frontend URL
  },
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private users: Map<string, string> = new Map(); // userId -> socketId

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  notifyUser(userId: number, notification: Notification) {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Remove user from the map
    for (const [userId, socketId] of this.users.entries()) {
      if (socketId === client.id) {
        this.users.delete(userId);
        break;
      }
    }
  }

  @SubscribeMessage('register')
  handleRegister(client: Socket, userId: string) {
    this.users.set(userId, client.id);
    console.log(`User ${userId} registered with socket ${client.id}`);
  }

  // Send notification to a specific user
  sendNotificationToUser(userId: string, notification: any) {
    const socketId = this.users.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('notification', notification);
    }
  }

  // Send notification to all connected clients
  sendNotificationToAll(notification: any) {
    this.server.emit('notification', notification);
  }
}
