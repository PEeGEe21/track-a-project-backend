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
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { WebsocketRateLimiterService } from 'src/common/rate-limit/websocket-rate-limiter.service';
import { config } from 'src/config';
import { RedisService } from 'src/redis/redis.service';
import { MessagesService } from './services/messages.service';

type CallType = 'video' | 'voice';
type CallStatus = 'ringing' | 'connected' | 'rejected' | 'missed' | 'ended';

type ActiveCall = {
  callId: string;
  conversationId: string;
  organizationId: string;
  roomName: string;
  callType: CallType;
  callerId: number;
  callerName: string;
  callerAvatar: string | null;
  recipientId: number;
  recipientName: string;
  recipientAvatar: string | null;
  initiatedAt: string;
  answeredAt?: string;
  endedAt?: string;
  status: CallStatus;
  timeout?: NodeJS.Timeout;
};

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
  private readonly activeCalls = new Map<string, ActiveCall>();
  private readonly callTimeoutMs = 30_000;
  private readonly livekitRoomService = config.livekit.enabled
    ? new RoomServiceClient(
        this.getLivekitServerUrl(config.livekit.url!),
        config.livekit.apiKey!,
        config.livekit.apiSecret!,
      )
    : null;

  constructor(
    private readonly websocketRateLimiter: WebsocketRateLimiterService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
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

      await this.handleDisconnectCallCleanup(userId);
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

  @SubscribeMessage('call:initiate')
  async handleInitiateCall(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      callId: string;
      conversationId: string;
      roomName: string;
      callType?: CallType;
    },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'call:initiate', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });

    const callerId = this.userSockets.get(client.id);
    if (!callerId) {
      throw new WsException('User is not registered for messaging');
    }

    if (!data?.callId || !data?.conversationId || !data?.roomName) {
      throw new WsException('Call ID, conversation ID, and room name are required');
    }

    if (this.activeCalls.has(data.callId)) {
      throw new WsException('A call with this ID already exists');
    }

    const callContext = await this.messagesService.getDirectCallContext(
      callerId,
      data.conversationId,
    );

    const recipientId = callContext.peerUserId;
    if (this.findUserActiveCall(recipientId) || this.findUserActiveCall(callerId)) {
      this.server.to(`user_${callerId}`).emit('call:error', {
        message: 'Either you or the recipient is already in another call.',
      });
      return { status: 'busy' };
    }

    const call: ActiveCall = {
      callId: data.callId,
      conversationId: data.conversationId,
      organizationId: callContext.organizationId,
      roomName: data.roomName,
      callType: data.callType === 'voice' ? 'voice' : 'video',
      callerId,
      callerName: callContext.callerName,
      callerAvatar: callContext.callerAvatar,
      recipientId,
      recipientName: callContext.peerName,
      recipientAvatar: callContext.peerAvatar,
      initiatedAt: new Date().toISOString(),
      status: 'ringing',
    };

    call.timeout = setTimeout(() => {
      void this.handleMissedCall(call.callId);
    }, this.callTimeoutMs);
    this.activeCalls.set(call.callId, call);

    this.server.to(`user_${callerId}`).emit('call:outgoing', this.serializeCall(call));
    this.server.to(`user_${recipientId}`).emit('call:incoming', this.serializeCall(call));

    return { status: 'ringing', callId: call.callId };
  }

  @SubscribeMessage('call:accept')
  async handleAcceptCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'call:accept', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });

    const userId = this.userSockets.get(client.id);
    if (!userId) {
      throw new WsException('User is not registered for messaging');
    }

    const call = this.activeCalls.get(data?.callId);
    if (!call || call.status !== 'ringing') {
      throw new WsException('This call is no longer available');
    }

    if (call.recipientId !== userId) {
      throw new WsException('Only the invited participant can accept this call');
    }

    this.clearCallTimer(call);
    call.status = 'connected';
    call.answeredAt = new Date().toISOString();
    this.activeCalls.set(call.callId, call);

    const payload = this.serializeCall(call);
    this.server.to(`user_${call.callerId}`).emit('call:accepted', payload);
    this.server.to(`user_${call.recipientId}`).emit('call:accepted', payload);

    return { status: 'connected', callId: call.callId };
  }

  @SubscribeMessage('call:reject')
  async handleRejectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; reason?: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'call:reject', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });

    const userId = this.userSockets.get(client.id);
    if (!userId) {
      throw new WsException('User is not registered for messaging');
    }

    const call = this.activeCalls.get(data?.callId);
    if (!call || call.status !== 'ringing') {
      throw new WsException('This call is no longer available');
    }

    if (call.recipientId !== userId) {
      throw new WsException('Only the invited participant can reject this call');
    }

    this.clearCallTimer(call);
    call.status = 'rejected';
    call.endedAt = new Date().toISOString();

    await this.messagesService.createSystemConversationMessage({
      conversationId: call.conversationId,
      organizationId: call.organizationId,
      senderId: call.recipientId,
      content: `${this.getCallLabel(call.callType)} was declined.`,
    });

    this.server.to(`user_${call.callerId}`).emit('call:rejected', {
      ...this.serializeCall(call),
      reason: data.reason ?? 'declined',
    });
    this.server.to(`user_${call.recipientId}`).emit('call:rejected', {
      ...this.serializeCall(call),
      reason: data.reason ?? 'declined',
    });

    this.activeCalls.delete(call.callId);
    return { status: 'rejected', callId: call.callId };
  }

  @SubscribeMessage('call:end')
  async handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'call:end', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });

    const userId = this.userSockets.get(client.id);
    if (!userId) {
      throw new WsException('User is not registered for messaging');
    }

    const call = this.activeCalls.get(data?.callId);
    if (!call) {
      throw new WsException('Call not found');
    }

    if (call.callerId !== userId && call.recipientId !== userId) {
      throw new WsException('You are not part of this call');
    }

    this.clearCallTimer(call);
    call.status = 'ended';
    call.endedAt = new Date().toISOString();

    await this.messagesService.createSystemConversationMessage({
      conversationId: call.conversationId,
      organizationId: call.organizationId,
      senderId: userId,
      content:
        call.answeredAt != null
          ? `${this.getCallLabel(call.callType)} ended.`
          : `${this.getCallLabel(call.callType)} ended before it was answered.`,
    });

    const payload = {
      ...this.serializeCall(call),
      endedBy: userId,
    };
    this.server.to(`user_${call.callerId}`).emit('call:ended', payload);
    this.server.to(`user_${call.recipientId}`).emit('call:ended', payload);
    this.activeCalls.delete(call.callId);

    return { status: 'ended', callId: call.callId };
  }

  @SubscribeMessage('call:join')
  async handleJoinCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'call:join', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });

    const userId = this.userSockets.get(client.id);
    if (!userId) {
      throw new WsException('User is not registered for messaging');
    }

    if (!config.livekit.enabled || !this.livekitRoomService) {
      throw new WsException('LiveKit is not configured on the server');
    }

    const call = this.activeCalls.get(data?.callId);
    if (!call) {
      throw new WsException('Call not found');
    }

    if (call.status !== 'connected') {
      throw new WsException('Call is not ready to join yet');
    }

    if (call.callerId !== userId && call.recipientId !== userId) {
      throw new WsException('You are not part of this call');
    }

    await this.ensureLivekitRoom(call.roomName);

    const token = await this.createLivekitToken({
      userId,
      socketId: client.id,
      roomName: call.roomName,
      displayName:
        call.callerId === userId ? call.callerName : call.recipientName,
      callType: call.callType,
      conversationId: call.conversationId,
      organizationId: call.organizationId,
    });

    return {
      status: 'ok',
      livekitUrl: config.livekit.url,
      token,
      roomName: call.roomName,
      callType: call.callType,
    };
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

  private clearCallTimer(call: ActiveCall) {
    if (call.timeout) {
      clearTimeout(call.timeout);
      call.timeout = undefined;
    }
  }

  private serializeCall(call: ActiveCall) {
    return {
      callId: call.callId,
      conversationId: call.conversationId,
      organizationId: call.organizationId,
      roomName: call.roomName,
      callType: call.callType,
      callerId: call.callerId,
      callerName: call.callerName,
      callerAvatar: call.callerAvatar,
      recipientId: call.recipientId,
      recipientName: call.recipientName,
      recipientAvatar: call.recipientAvatar,
      initiatedAt: call.initiatedAt,
      answeredAt: call.answeredAt,
      endedAt: call.endedAt,
      status: call.status,
    };
  }

  private getCallLabel(callType: CallType) {
    return callType === 'voice' ? 'Voice call' : 'Video call';
  }

  private findUserActiveCall(userId: number) {
    for (const call of this.activeCalls.values()) {
      if (
        (call.callerId === userId || call.recipientId === userId) &&
        (call.status === 'ringing' || call.status === 'connected')
      ) {
        return call;
      }
    }

    return null;
  }

  private async handleMissedCall(callId: string) {
    const call = this.activeCalls.get(callId);
    if (!call || call.status !== 'ringing') {
      return;
    }

    this.clearCallTimer(call);
    call.status = 'missed';
    call.endedAt = new Date().toISOString();

    await this.messagesService.createSystemConversationMessage({
      conversationId: call.conversationId,
      organizationId: call.organizationId,
      senderId: call.callerId,
      content: `Missed ${call.callType === 'voice' ? 'voice' : 'video'} call.`,
    });

    const payload = this.serializeCall(call);
    this.server.to(`user_${call.callerId}`).emit('call:missed', payload);
    this.server.to(`user_${call.recipientId}`).emit('call:missed', payload);
    this.activeCalls.delete(call.callId);
  }

  private async handleDisconnectCallCleanup(userId: number) {
    const calls = [...this.activeCalls.values()].filter(
      (call) =>
        (call.callerId === userId || call.recipientId === userId) &&
        call.status === 'connected',
    );

    for (const call of calls) {
      this.clearCallTimer(call);
      call.status = 'ended';
      call.endedAt = new Date().toISOString();

      await this.messagesService.createSystemConversationMessage({
        conversationId: call.conversationId,
        organizationId: call.organizationId,
        senderId: userId,
        content: `${this.getCallLabel(call.callType)} ended.`,
      });

      const payload = {
        ...this.serializeCall(call),
        endedBy: userId,
        reason: 'disconnect',
      };
      this.server.to(`user_${call.callerId}`).emit('call:ended', payload);
      this.server.to(`user_${call.recipientId}`).emit('call:ended', payload);
      this.activeCalls.delete(call.callId);
    }
  }

  private async ensureLivekitRoom(roomName: string) {
    if (!this.livekitRoomService) {
      throw new WsException('LiveKit room service is unavailable');
    }

    try {
      await this.livekitRoomService.createRoom({
        name: roomName,
        emptyTimeout: 60 * 5,
        maxParticipants: 2,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

      if (!message.includes('already exists')) {
        const trace = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Failed to create LiveKit room ${roomName}`, trace);
        throw new WsException('Unable to prepare the call room');
      }
    }
  }

  private async createLivekitToken({
    userId,
    socketId,
    roomName,
    displayName,
    callType,
    conversationId,
    organizationId,
  }: {
    userId: number;
    socketId: string;
    roomName: string;
    displayName: string;
    callType: CallType;
    conversationId: string;
    organizationId: string;
  }) {
    const token = new AccessToken(
      config.livekit.apiKey!,
      config.livekit.apiSecret!,
      {
        identity: `user-${userId}-socket-${socketId}`,
        name: displayName,
        metadata: JSON.stringify({
          userId,
          conversationId,
          organizationId,
          callType,
        }),
      },
    );

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return token.toJwt();
  }

  private getLivekitServerUrl(url: string) {
    if (url.startsWith('wss://')) {
      return `https://${url.slice('wss://'.length)}`;
    }

    if (url.startsWith('ws://')) {
      return `http://${url.slice('ws://'.length)}`;
    }

    return url;
  }
}
