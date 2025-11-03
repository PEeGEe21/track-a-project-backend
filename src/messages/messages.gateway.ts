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
import { Injectable, Logger, UseGuards } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

  private onlineUsers: Map<number, string> = new Map(); // userId -> socketId
  private userSockets: Map<string, number> = new Map(); // socketId -> userId
  private readonly logger = new Logger(MessagesGateway.name);

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

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = this.userSockets.get(client.id);

    if (userId) {
      this.onlineUsers.delete(userId);
      this.userSockets.delete(client.id);

      this.logger.log(`User ${userId} went offline`);

      // Notify others that this user went offline
      this.server.emit('user_status_changed', {
        userId,
        online: false,
        timestamp: new Date().toISOString(),
      });
    }

    this.logger.log(`Client disconnected from messages: ${client.id}`);
  }

  @SubscribeMessage('register_user')
  handleRegisterUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    const { userId } = data;

    if (!userId) {
      throw new WsException('User ID is required');
    }

    this.logger.log(
      `User ${userId} registered for messaging with socket ${client.id}`,
    );

    // Store mappings
    this.onlineUsers.set(userId, client.id);
    this.userSockets.set(client.id, userId);

    // Join user-specific room
    client.join(`user_${userId}`);

    // Notify others that this user is online
    this.server.emit('user_status_changed', {
      userId,
      online: true,
      timestamp: new Date().toISOString(),
    });

    client.emit('register_confirm', {
      status: 'registered',
      userId,
      socketId: client.id,
    });

    return { status: 'registered', userId };
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
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
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
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
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
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
  handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string },
  ) {
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


    console.log(message, 'messagemessagemessage')
    // Send to everyone in the conversation
    this.server.to(`conversation_${conversationId}`).emit('new_message', {
      conversationId,
      message,
    });
  }

  // Notify specific user about new conversation
  notifyNewConversation(userId: number, conversation: any) {
    const socketId = this.onlineUsers.get(userId);

    if (socketId) {
      this.logger.log(`Notifying user ${userId} about new conversation`);
      this.server.to(socketId).emit('new_conversation', conversation);
    } else {
      this.logger.log(
        `User ${userId} is offline, cannot notify about new conversation`,
      );
    }
  }

  // Check if user is online
  isUserOnline(userId: number): boolean {
    return this.onlineUsers.has(userId);
  }

  // Get all online users
  getOnlineUsers(): number[] {
    return Array.from(this.onlineUsers.keys());
  }

  // messages.gateway.ts – add typing broadcast to the *sender* as well (so UI can show own typing)
  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.userSockets.get(client.id);
    if (!userId || !data.conversationId) return;
    this.server.to(`conversation_${data.conversationId}`).emit('user_typing', {
      conversationId: data.conversationId,
      userId,
      isTyping: true,
    });
  }
}
