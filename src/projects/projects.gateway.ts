import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import { type Server, Socket } from 'socket.io';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { ProjectsService } from './services/projects.service';
import { WebsocketRateLimiterService } from 'src/common/rate-limit/websocket-rate-limiter.service';
import { config } from 'src/config';

type CallType = 'video' | 'voice';
type ProjectCallStatus = 'ringing' | 'connected' | 'rejected' | 'missed' | 'ended';

type ProjectCallParticipant = {
  userId: number;
  name: string;
  avatar: string | null;
};

type ActiveProjectCall = {
  callId: string;
  projectId: number;
  projectName: string;
  organizationId: string | null;
  roomName: string;
  callType: CallType;
  callerId: number;
  callerName: string;
  callerAvatar: string | null;
  participantIds: number[];
  participants: ProjectCallParticipant[];
  joinedParticipantIds: number[];
  rejectedParticipantIds: number[];
  initiatedAt: string;
  answeredAt?: string;
  endedAt?: string;
  status: ProjectCallStatus;
  timeout?: NodeJS.Timeout;
};

type ProjectIngestionRealtimePayload = {
  projectId: number;
  taskId: number;
  action: 'created' | 'deduped' | 'reopened';
  occurrenceCount: number;
  source?: string;
  dedupeKey?: string | null;
};

@WebSocketGateway({
  cors: {
    origin: config.corsAllowedOrigins,
    credentials: true,
  },
  namespace: '/project',
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
  private readonly activeCalls = new Map<string, ActiveProjectCall>();
  private readonly callTimeoutMs = 30_000;
  private readonly livekitRoomService = config.livekit.enabled
    ? new RoomServiceClient(
        this.getLivekitServerUrl(config.livekit.url!),
        config.livekit.apiKey!,
        config.livekit.apiSecret!,
      )
    : null;

  constructor(
    @Inject(forwardRef(() => ProjectsService))
    private projectService: ProjectsService,
    private readonly websocketRateLimiter: WebsocketRateLimiterService,
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

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Get userId from socketId
    const userId = this.socketToUser.get(client.id);

    // Clean up maps
    if (userId) {
      await this.handleDisconnectCallCleanup(Number(userId));
      this.users.delete(userId);
      this.socketToUser.delete(client.id);

      // Remove user from project rooms
      for (const [projectId, users] of this.projectRooms.entries()) {
        if (users.has(userId)) {
          users.delete(userId);
          this.logger.log(
            `User ${userId} removed from project ${projectId} due to disconnect`,
          );
        }
      }

      this.logger.log(`User ${userId} unregistered due to disconnect`);
    }

    return { status: 'disconnected', userId };
  }

  @SubscribeMessage('register')
  async handleRegister(client: Socket, userId: string) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'register', {
      limit: config.rateLimit.authMax,
      ttlMs: config.rateLimit.authWindowMs,
    });
    if (!userId) {
      throw new WsException('User ID is required');
    }

    this.logger.log(`User ${userId} registered with socket ${client.id}`);

    // Store the mapping in both directions
    this.users.set(userId, client.id);
    this.socketToUser.set(client.id, userId);

    // Join personal room
    client.join(`user_${userId}`);

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
  async handleJoinProject(client: Socket, projectId: string | number) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'join_project');
    const userId = this.socketToUser.get(client.id);
    if (!userId) {
      this.logger.warn(
        `Socket ${client.id} tried to join project ${projectId} but is not registered`,
      );
      return { status: 'error', message: 'User not registered' };
    }

    const isCollaborator = await this.projectService.isProjectCollaborator(
      Number(userId),
      Number(projectId),
    );
    if (!isCollaborator) {
      throw new WsException('Only project collaborators can join this room');
    }

    this.joinProjectRoom(client, userId, projectId);
    return { status: 'joined', projectId };
  }

  @SubscribeMessage('leave_project')
  async handleLeaveProject(client: Socket, projectId: string | number) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'leave_project');
    const userId = this.socketToUser.get(client.id);
    if (!userId) {
      return { status: 'error', message: 'User not registered' };
    }

    // Leave the socket.io room
    client.leave(`project_${projectId}`);

    // Update our tracking
    const projectRoom = this.projectRooms.get(String(projectId));
    if (projectRoom) {
      projectRoom.delete(userId);
    }

    this.logger.log(`User ${userId} left project room: project_${projectId}`);
    return { status: 'left', projectId };
  }

  private joinProjectRoom(
    client: Socket,
    userId: string,
    projectId: string | number,
  ) {
    // Join the socket.io room
    client.join(`project_${projectId}`);

    // Track in our map
    const projectIdStr = String(projectId);
    if (!this.projectRooms.has(projectIdStr)) {
      this.projectRooms.set(projectIdStr, new Set());
    }
    this.projectRooms.get(projectIdStr)?.add(userId);

    this.logger.log(`User ${userId} joined project room: project_${projectId}`);
  }

  @SubscribeMessage('new_comment')
  async handleNewComment(client: Socket, payload) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'new_comment', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketBurstWindowMs,
    });
    // Extract projectId from payload
    const projectId = payload.projectId;
    if (!projectId) {
      this.logger.warn('Received new_comment without projectId', payload);
      return { status: 'error', message: 'projectId is required' };
    }

    this.logger.log(`Broadcasting new comment to project_${projectId}`, {
      roomSize:
        this.server?.sockets?.adapter?.rooms?.get(`project_${projectId}`)?.size ||
        0,
    });

    // Ensure the payload has a consistent format
    const commentPayload = payload.comment
      ? payload
      : {
          projectId,
          comment: payload,
        };

    // Broadcast to ALL clients in the project room INCLUDING the sender
    this.server.to(`project_${projectId}`).emit('new_comment', commentPayload);

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
    await this.websocketRateLimiter.assertWithinLimit(client, 'add_reaction', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketBurstWindowMs,
    });
    const { projectId, messageId, userId, emoji } = payload;
    if (!projectId || !messageId || !userId || !emoji) return;

    // Call the service with the user object structure it expects
    await this.projectService.addReaction({ userId }, messageId, emoji);

    // Broadcast to project
    this.server.to(`project_${projectId}`).emit('reaction_added', {
      projectId,
      messageId,
      userId,
      emoji,
    });
  }

  @SubscribeMessage('typing')
  async handleTyping(
    client: Socket,
    payload: { projectId: string; userId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'typing', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketBurstWindowMs,
    });
    const { projectId, userId } = payload;
    if (!projectId || !userId) return;

    const user = await this.projectService.getUserAccountById(userId);

    // Broadcast to project room (except sender)
    client.to(`project_${projectId}`).emit('user_typing', {
      projectId,
      user,
    });
  }

  @SubscribeMessage('stop_typing')
  async handleStopTyping(
    client: Socket,
    payload: { projectId: string; userId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'stop_typing', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketBurstWindowMs,
    });
    const { projectId, userId } = payload;
    if (!projectId || !userId) return;

    client.to(`project_${projectId}`).emit('user_stop_typing', {
      projectId,
      userId,
    });
  }

  @SubscribeMessage('get_project_messages')
  async handleGetProjectMessages(
    client: Socket,
    payload: { projectId: string; userId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(
      client,
      'get_project_messages',
    );
    const { projectId, userId } = payload;
    if (!projectId || !userId) {
      throw new WsException('projectId and userId required');
    }

    const isCollaborator = await this.projectService.isProjectCollaborator(
      Number(userId),
      Number(projectId),
    );
    if (!isCollaborator) {
      throw new WsException(
        'Only project collaborators can access project messages',
      );
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

  @SubscribeMessage('call:initiate')
  async handleInitiateProjectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      callId: string;
      projectId: number;
      roomName: string;
      callType?: CallType;
    },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'call:initiate', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });

    const callerId = Number(this.socketToUser.get(client.id));
    if (!callerId) {
      throw new WsException('User not registered');
    }

    if (!data?.callId || !data?.projectId || !data?.roomName) {
      throw new WsException('callId, projectId, and roomName are required');
    }

    if (this.activeCalls.has(data.callId)) {
      throw new WsException('A project call with this ID already exists');
    }

    const callContext = await this.projectService.getProjectCallContext(
      { userId: callerId },
      Number(data.projectId),
    );

    const participantIds = callContext.recipients.map(
      (participant) => participant.userId,
    );

    if (this.findUserActiveCall(callerId)) {
      throw new WsException('You are already in another project call.');
    }

    const busyParticipant = participantIds.find((participantId) =>
      this.findUserActiveCall(participantId),
    );
    if (busyParticipant) {
      throw new WsException(
        'One or more collaborators are already in another call.',
      );
    }

    const call: ActiveProjectCall = {
      callId: data.callId,
      projectId: callContext.projectId,
      projectName: callContext.projectName,
      organizationId: callContext.organizationId,
      roomName: data.roomName,
      callType: data.callType === 'voice' ? 'voice' : 'video',
      callerId,
      callerName: callContext.caller.name,
      callerAvatar: callContext.caller.avatar,
      participantIds,
      participants: callContext.recipients,
      joinedParticipantIds: [],
      rejectedParticipantIds: [],
      initiatedAt: new Date().toISOString(),
      status: 'ringing',
    };

    call.timeout = setTimeout(() => {
      void this.handleMissedCall(call.callId);
    }, this.callTimeoutMs);

    this.activeCalls.set(call.callId, call);

    await this.projectService.createSystemProjectComment({
      projectId: call.projectId,
      actorUserId: call.callerId,
      content: `${call.callType === 'voice' ? 'Voice' : 'Video'} call started in the project room.`,
      organizationId: call.organizationId,
    });

    this.server.to(`user_${callerId}`).emit('call:outgoing', this.serializeCall(call));
    participantIds.forEach((participantId) => {
      this.server
        .to(`user_${participantId}`)
        .emit('call:incoming', this.serializeCall(call));
    });
    client
      .to(`project_${call.projectId}`)
      .emit('call:incoming', this.serializeCall(call));

    return { status: 'ringing', callId: call.callId };
  }

  @SubscribeMessage('call:accept')
  async handleAcceptProjectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'call:accept', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });

    const userId = Number(this.socketToUser.get(client.id));
    if (!userId) {
      throw new WsException('User not registered');
    }

    const call = this.activeCalls.get(data?.callId);
    if (!call || (call.status !== 'ringing' && call.status !== 'connected')) {
      throw new WsException('This project call is no longer available');
    }

    if (!call.participantIds.includes(userId)) {
      throw new WsException('Only invited collaborators can accept this call');
    }

    this.clearCallTimer(call);
    call.status = 'connected';
    call.answeredAt = call.answeredAt ?? new Date().toISOString();
    call.rejectedParticipantIds = call.rejectedParticipantIds.filter(
      (participantId) => participantId !== userId,
    );
    this.activeCalls.set(call.callId, call);

    const participant = call.participants.find(
      (candidate) => candidate.userId === userId,
    );

    const payload = {
      ...this.serializeCall(call),
      answeredById: userId,
      answeredByName: participant?.name ?? 'Collaborator',
    };

    this.server.to(`user_${call.callerId}`).emit('call:accepted', payload);
    this.server.to(`user_${userId}`).emit('call:accepted', payload);

    return { status: 'connected', callId: call.callId };
  }

  @SubscribeMessage('call:reject')
  async handleRejectProjectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; reason?: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'call:reject', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });

    const userId = Number(this.socketToUser.get(client.id));
    if (!userId) {
      throw new WsException('User not registered');
    }

    const call = this.activeCalls.get(data?.callId);
    if (!call || call.status !== 'ringing') {
      throw new WsException('This project call is no longer available');
    }

    if (!call.participantIds.includes(userId)) {
      throw new WsException('Only invited collaborators can reject this call');
    }

    if (!call.rejectedParticipantIds.includes(userId)) {
      call.rejectedParticipantIds.push(userId);
    }

    const everyoneRejected =
      call.rejectedParticipantIds.length >= call.participantIds.length;

    if (!everyoneRejected) {
      return {
        status: 'rejected',
        callId: call.callId,
        pendingParticipants:
          call.participantIds.length - call.rejectedParticipantIds.length,
      };
    }

    this.clearCallTimer(call);
    call.status = 'rejected';
    call.endedAt = new Date().toISOString();

    await this.projectService.createSystemProjectComment({
      projectId: call.projectId,
      actorUserId: userId,
      content: `${call.callType === 'voice' ? 'Voice' : 'Video'} call was declined.`,
      organizationId: call.organizationId,
    });

    const payload = {
      ...this.serializeCall(call),
      reason: data.reason ?? 'declined',
    };

    this.server.to(`user_${call.callerId}`).emit('call:rejected', payload);
    call.participantIds.forEach((participantId) => {
      this.server.to(`user_${participantId}`).emit('call:rejected', payload);
    });

    this.activeCalls.delete(call.callId);
    return { status: 'rejected', callId: call.callId };
  }

  @SubscribeMessage('call:end')
  async handleEndProjectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'call:end', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });

    const userId = Number(this.socketToUser.get(client.id));
    if (!userId) {
      throw new WsException('User not registered');
    }

    const call = this.activeCalls.get(data?.callId);
    if (!call) {
      throw new WsException('Project call not found');
    }

    if (call.callerId !== userId && !call.participantIds.includes(userId)) {
      throw new WsException('You are not part of this project call');
    }

    this.clearCallTimer(call);
    call.status = 'ended';
    call.endedAt = new Date().toISOString();

    await this.projectService.createSystemProjectComment({
      projectId: call.projectId,
      actorUserId: userId,
      content:
        call.answeredAt != null
          ? `${call.callType === 'voice' ? 'Voice' : 'Video'} call ended.`
          : `${call.callType === 'voice' ? 'Voice' : 'Video'} call ended before anyone joined.`,
      organizationId: call.organizationId,
    });

    const payload = {
      ...this.serializeCall(call),
      endedBy: userId,
    };

    this.server.to(`user_${call.callerId}`).emit('call:ended', payload);
    call.participantIds.forEach((participantId) => {
      this.server.to(`user_${participantId}`).emit('call:ended', payload);
    });

    this.activeCalls.delete(call.callId);
    return { status: 'ended', callId: call.callId };
  }

  @SubscribeMessage('call:join')
  async handleJoinProjectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string },
  ) {
    await this.websocketRateLimiter.assertWithinLimit(client, 'call:join', {
      limit: config.rateLimit.websocketBurstMax,
      ttlMs: config.rateLimit.websocketWindowMs,
    });

    const userId = Number(this.socketToUser.get(client.id));
    if (!userId) {
      throw new WsException('User not registered');
    }

    if (!config.livekit.enabled || !this.livekitRoomService) {
      throw new WsException('LiveKit is not configured on the server');
    }

    const call = this.activeCalls.get(data?.callId);
    if (!call) {
      throw new WsException('Project call not found');
    }

    const isAllowedParticipant =
      call.callerId === userId || call.participantIds.includes(userId);
    if (!isAllowedParticipant) {
      throw new WsException(
        'Only project collaborators invited to this call can join it.',
      );
    }

    if (call.status !== 'connected' && call.status !== 'ringing') {
      throw new WsException('Project call is not joinable right now');
    }

    call.status = 'connected';
    call.answeredAt = call.answeredAt ?? new Date().toISOString();
    if (!call.joinedParticipantIds.includes(userId)) {
      call.joinedParticipantIds.push(userId);
    }
    this.activeCalls.set(call.callId, call);

    await this.ensureLivekitRoom(
      call.roomName,
      Math.max(call.participantIds.length + 1, 2),
    );

    const joiningParticipant =
      userId === call.callerId
        ? {
            name: call.callerName,
          }
        : call.participants.find((participant) => participant.userId === userId);

    const payload = {
      ...this.serializeCall(call),
      joinedById: userId,
      joinedByName: joiningParticipant?.name ?? 'Collaborator',
    };
    this.server.to(`user_${call.callerId}`).emit('call:participant_joined', payload);
    call.participantIds.forEach((participantId) => {
      this.server
        .to(`user_${participantId}`)
        .emit('call:participant_joined', payload);
    });

    const token = await this.createLivekitToken({
      userId,
      socketId: client.id,
      roomName: call.roomName,
      displayName:
        userId === call.callerId
          ? call.callerName
          : joiningParticipant?.name ?? 'Collaborator',
      callType: call.callType,
      projectId: call.projectId,
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

  emitIngestionUpdated(payload: ProjectIngestionRealtimePayload) {
    this.logger.log(
      `Broadcasting ingestion update to project_${payload.projectId}`,
      {
        action: payload.action,
        taskId: payload.taskId,
        roomSize:
          this.server?.sockets?.adapter?.rooms?.get(
            `project_${payload.projectId}`,
          )?.size || 0,
      },
    );

    this.server
      .to(`project_${payload.projectId}`)
      .emit('project:ingestion-updated', payload);
  }

  private clearCallTimer(call: ActiveProjectCall) {
    if (call.timeout) {
      clearTimeout(call.timeout);
      call.timeout = undefined;
    }
  }

  private serializeCall(call: ActiveProjectCall) {
    return {
      callId: call.callId,
      projectId: call.projectId,
      projectName: call.projectName,
      organizationId: call.organizationId,
      roomName: call.roomName,
      callType: call.callType,
      callerId: call.callerId,
      callerName: call.callerName,
      callerAvatar: call.callerAvatar,
      recipientId: call.projectId,
      recipientName: call.projectName,
      recipientAvatar: null,
      participantIds: call.participantIds,
      participantCount: call.participantIds.length + 1,
      joinedParticipantIds: call.joinedParticipantIds,
      initiatedAt: call.initiatedAt,
      answeredAt: call.answeredAt,
      endedAt: call.endedAt,
      status: call.status,
      scope: 'project',
    };
  }

  private findUserActiveCall(userId: number) {
    for (const call of this.activeCalls.values()) {
      if (
        (call.callerId === userId || call.participantIds.includes(userId)) &&
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

    await this.projectService.createSystemProjectComment({
      projectId: call.projectId,
      actorUserId: call.callerId,
      content: `Missed ${call.callType === 'voice' ? 'voice' : 'video'} call.`,
      organizationId: call.organizationId,
    });

    const payload = this.serializeCall(call);
    this.server.to(`user_${call.callerId}`).emit('call:missed', payload);
    call.participantIds.forEach((participantId) => {
      this.server.to(`user_${participantId}`).emit('call:missed', payload);
    });

    this.activeCalls.delete(call.callId);
  }

  private async handleDisconnectCallCleanup(userId: number) {
    const calls = [...this.activeCalls.values()].filter(
      (call) =>
        (call.callerId === userId || call.participantIds.includes(userId)) &&
        (call.status === 'ringing' || call.status === 'connected'),
    );

    for (const call of calls) {
      this.clearCallTimer(call);
      call.status = 'ended';
      call.endedAt = new Date().toISOString();

      await this.projectService.createSystemProjectComment({
        projectId: call.projectId,
        actorUserId: userId,
        content: `${call.callType === 'voice' ? 'Voice' : 'Video'} call ended.`,
        organizationId: call.organizationId,
      });

      const payload = {
        ...this.serializeCall(call),
        endedBy: userId,
        reason: 'disconnect',
      };

      this.server.to(`user_${call.callerId}`).emit('call:ended', payload);
      call.participantIds.forEach((participantId) => {
        this.server.to(`user_${participantId}`).emit('call:ended', payload);
      });

      this.activeCalls.delete(call.callId);
    }
  }

  private async ensureLivekitRoom(roomName: string, maxParticipants: number) {
    if (!this.livekitRoomService) {
      throw new WsException('LiveKit room service is unavailable');
    }

    try {
      await this.livekitRoomService.createRoom({
        name: roomName,
        emptyTimeout: 60 * 5,
        maxParticipants,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

      if (!message.includes('already exists')) {
        const trace = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Failed to create LiveKit room ${roomName}`, trace);
        throw new WsException('Unable to prepare the project call room');
      }
    }
  }

  private async createLivekitToken({
    userId,
    socketId,
    roomName,
    displayName,
    callType,
    projectId,
    organizationId,
  }: {
    userId: number;
    socketId: string;
    roomName: string;
    displayName: string;
    callType: CallType;
    projectId: number;
    organizationId: string | null;
  }) {
    const token = new AccessToken(
      config.livekit.apiKey!,
      config.livekit.apiSecret!,
      {
        identity: `project-user-${userId}-socket-${socketId}`,
        name: displayName,
        metadata: JSON.stringify({
          userId,
          projectId,
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

  // Debug method to get active connections
  getActiveConnections() {
    return {
      totalSockets: this.server.sockets.sockets.size,
      registeredUsers: Object.fromEntries(this.users),
      projectRooms: Object.fromEntries(
        Array.from(this.projectRooms.entries()).map(([projectId, users]) => [
          projectId,
          Array.from(users),
        ]),
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
