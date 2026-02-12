import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Message } from 'src/typeorm/entities/Message';
import { In, Repository } from 'typeorm';
import { Conversation } from 'src/typeorm/entities/Conversation';
import { ConversationParticipant } from 'src/typeorm/entities/ConversationParticipant';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { UsersService } from 'src/users/services/users.service';
import { MessageResponseDto } from '../dto/message-response.dto';
import { plainToInstance } from 'class-transformer';
import { MessagesGateway } from '../messages.gateway';
import { NOTIFICATION_TYPES } from 'src/utils/constants/notifications';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { Organization } from 'src/typeorm/entities/Organization';

@Injectable()
export class MessagesService {
  constructor(
    private usersService: UsersService,
    private notificationService: NotificationsService,
    private messagesGateway: MessagesGateway,

    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepository: Repository<ConversationParticipant>,
    @InjectRepository(UserOrganization)
    private readonly userOrganizationRepository: Repository<UserOrganization>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  /**
   * Get all conversations for the current user within their organization
   */
  async getUserConversations(user: any, organizationId: string) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Verify user is a member of the organization
      const userOrg = await this.userOrganizationRepository.findOne({
        where: {
          user_id: userFound.id,
          organization_id: organizationId,
          is_active: true,
        },
      });

      if (!userOrg) {
        throw new HttpException(
          'You are not a member of this organization',
          HttpStatus.FORBIDDEN,
        );
      }

      const userId = Number(userFound.id);

      // Get active participants for this user in this organization
      const activeParticipants = await this.participantRepository.find({
        where: {
          userId,
          isActive: true,
          organization_id: organizationId,
        },
        select: ['conversationId'],
      });

      const conversationIds = activeParticipants.map((p) => p.conversationId);

      if (conversationIds.length === 0) {
        return { data: [], success: true, message: 'No conversations found' };
      }

      // Get conversations with organization filter
      const conversations = await this.conversationRepository.find({
        where: {
          id: In(conversationIds),
          organization_id: organizationId,
        },
        order: { lastMessageAt: 'DESC' },
      });

      return await this.buildConversationResponse(
        conversations,
        userId,
        organizationId,
      );
    } catch (err) {
      console.error('❌ Error in getUserConversations:', err);
      throw new HttpException(
        err?.message || 'Failed to get conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Build conversation response with organization context
   */
  private async buildConversationResponse(
    conversations: Conversation[],
    userId: number,
    organizationId: string,
  ) {
    const conversationIds = conversations.map((c) => c.id);

    // Load participants with organization filter
    const participants = await this.participantRepository.find({
      where: {
        conversationId: In(conversationIds),
        isActive: true,
        organization_id: organizationId,
      },
    });

    // Get unique user IDs and load users
    const userIds = [...new Set(participants.map((p) => Number(p.userId)))];
    const users = await this.usersService.getUsersByIds(userIds);

    // Create a map for quick user lookup
    const userMap = new Map(users.map((u) => [Number(u.id), u]));

    // Get last message for each conversation
    const lastMessages = await this.messageRepository
      .createQueryBuilder('message')
      .select([
        'message.id',
        'message.conversationId',
        'message.content',
        'message.senderId',
        'message.created_at',
      ])
      .where((qb) => {
        const subQuery = qb
          .subQuery()
          .select('MAX(m2.created_at)')
          .from(Message, 'm2')
          .where('m2.conversationId = message.conversationId')
          .andWhere('m2.organization_id = :organizationId', { organizationId })
          .getQuery();
        return `message.created_at = (${subQuery})`;
      })
      .andWhere('message.conversationId IN (:...ids)', { ids: conversationIds })
      .andWhere('message.organization_id = :organizationId', { organizationId })
      .getMany();

    // Build enriched data
    const enrichedData = conversations.map((conv) => {
      const convParticipants = participants.filter(
        (p) => p.conversationId === conv.id,
      );

      const peerUserId = convParticipants
        .map((p) => Number(p.userId))
        .find((id) => id !== userId);

      const peer = peerUserId ? userMap.get(peerUserId) : null;

      const lastMessage = lastMessages.find(
        (m) => m.conversationId === conv.id,
      );

      const displayName =
        conv.type === 'direct'
          ? peer?.fullName ||
            `${peer?.first_name || ''} ${peer?.last_name || ''}`.trim() ||
            peer?.username ||
            'Unknown User'
          : conv.name || 'Unnamed Group';

      const displayAvatar =
        conv.type === 'direct' ? peer?.avatar || '' : conv.avatar || '';

      return {
        id: conv.id,
        type: conv.type,
        name: displayName,
        avatar: displayAvatar,
        online: conv.type === 'direct' ? peer?.logged_in || false : undefined,
        peer: peer
          ? {
              id: peer.id,
              fullName: peer.fullName ?? '',
              first_name: peer.first_name,
              last_name: peer.last_name,
              username: peer.username,
              email: peer.email,
              avatar: peer.avatar,
              logged_in: peer.logged_in,
            }
          : null,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content || '',
              time: this.formatTime(lastMessage.created_at),
              senderId: lastMessage.senderId,
            }
          : null,
        unread: 0,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
      };
    });

    return {
      data: enrichedData,
      success: true,
      message: 'success',
    };
  }

  /**
   * Start a new conversation with an organization member
   */
  async startConversationWithMember(
    user: any,
    memberId: number,
    organizationId: string,
  ) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Verify both users are members of the organization
      const userOrg = await this.userOrganizationRepository.findOne({
        where: {
          user_id: userFound.id,
          organization_id: organizationId,
          is_active: true,
        },
      });

      if (!userOrg) {
        throw new HttpException(
          'You are not a member of this organization',
          HttpStatus.FORBIDDEN,
        );
      }

      const userId = Number(userFound.id);
      const memberIdNum = Number(memberId);

      if (userId === memberIdNum) {
        throw new BadRequestException(
          "You can't start a conversation with yourself.",
        );
      }

      // Verify the other member exists and is in the organization
      const memberOrg = await this.userOrganizationRepository.findOne({
        where: {
          user_id: memberIdNum,
          organization_id: organizationId,
          is_active: true,
        },
        relations: ['user'],
      });

      if (!memberOrg) {
        throw new NotFoundException('Member not found in this organization');
      }

      const memberUser = memberOrg.user;

      // Check if a direct conversation already exists
      const userConversations = await this.participantRepository
        .createQueryBuilder('cp1')
        .select('cp1.conversationId')
        .where('cp1.userId = :userId', { userId })
        .andWhere('cp1.isActive = true')
        .andWhere('cp1.organization_id = :organizationId', { organizationId })
        .getMany();

      const userConvIds = userConversations.map((p) => p.conversationId);

      if (userConvIds.length > 0) {
        const sharedConversation = await this.participantRepository
          .createQueryBuilder('cp2')
          .select('cp2.conversationId')
          .where('cp2.conversationId IN (:...ids)', { ids: userConvIds })
          .andWhere('cp2.userId = :memberId', { memberId: memberIdNum })
          .andWhere('cp2.isActive = true')
          .andWhere('cp2.organization_id = :organizationId', { organizationId })
          .getOne();

        if (sharedConversation) {
          const existing = await this.conversationRepository.findOne({
            where: {
              id: sharedConversation.conversationId,
              type: 'direct',
              organization_id: organizationId,
            },
          });

          if (existing) {
            const participants = await this.participantRepository.find({
              where: {
                conversationId: existing.id,
                organization_id: organizationId,
              },
              relations: ['user'],
            });

            const peer = participants
              .map((p) => p.user)
              .find((u) => u?.id !== userId);

            return {
              data: {
                id: existing.id,
                type: existing.type,
                name:
                  peer?.fullName ||
                  `${peer?.first_name || ''} ${peer?.last_name || ''}`.trim() ||
                  peer?.username ||
                  'Unknown User',
                avatar: peer?.avatar || '',
                online: peer?.logged_in || false,
                peer: {
                  id: peer.id,
                  fullName: peer.fullName ?? '',
                  first_name: peer.first_name,
                  last_name: peer.last_name,
                  username: peer.username,
                  email: peer.email,
                  avatar: peer.avatar,
                  logged_in: peer.logged_in,
                },
                lastMessage: null,
                unread: 0,
                created_at: existing.created_at,
                updated_at: existing.updated_at,
              },
              success: true,
              message: 'Conversation already exists',
            };
          }
        }
      }

      // Create new conversation
      const conversation = this.conversationRepository.create({
        type: 'direct',
        created_by: userId,
        createdBy: userFound,
        organization_id: organizationId,
      });
      const savedConversation =
        await this.conversationRepository.save(conversation);

      // Add participants
      const participants = [
        {
          conversationId: savedConversation.id,
          conversation: savedConversation,
          userId: userId,
          user: userFound,
          role: 'member' as const,
          isActive: true,
          joinedAt: new Date(),
          organization_id: organizationId,
        },
        {
          conversationId: savedConversation.id,
          conversation: savedConversation,
          userId: memberIdNum,
          user: memberUser,
          role: 'member' as const,
          isActive: true,
          joinedAt: new Date(),
          organization_id: organizationId,
        },
      ];

      await this.participantRepository
        .createQueryBuilder()
        .insert()
        .into(ConversationParticipant)
        .values(participants)
        .execute();

      return {
        data: {
          id: savedConversation.id,
          type: savedConversation.type,
          name:
            memberUser?.fullName ||
            `${memberUser?.first_name || ''} ${
              memberUser?.last_name || ''
            }`.trim() ||
            memberUser?.username ||
            'Unknown User',
          avatar: memberUser?.avatar || '',
          online: memberUser?.logged_in || false,
          peer: {
            id: memberUser.id,
            fullName: memberUser.fullName ?? '',
            first_name: memberUser.first_name,
            last_name: memberUser.last_name,
            username: memberUser.username,
            email: memberUser.email,
            avatar: memberUser.avatar,
            logged_in: memberUser.logged_in,
          },
          lastMessage: null,
          unread: 0,
          created_at: savedConversation.created_at,
          updated_at: savedConversation.updated_at,
        },
        success: true,
        message: 'New conversation started successfully',
      };
    } catch (err) {
      console.error('❌ Error in startConversationWithMember:', err);
      throw new HttpException(
        err?.message || 'Failed to start conversation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(
    user: any,
    conversationId: string,
    organizationId: string,
  ) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound)
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);

      // Verify user is in the organization
      const userOrg = await this.userOrganizationRepository.findOne({
        where: {
          user_id: userFound.id,
          organization_id: organizationId,
          is_active: true,
        },
      });

      if (!userOrg) {
        throw new HttpException(
          'You are not a member of this organization',
          HttpStatus.FORBIDDEN,
        );
      }

      // Verify user is a participant in the conversation
      const participant = await this.participantRepository.findOne({
        where: {
          conversationId,
          userId: userFound.id,
          isActive: true,
          organization_id: organizationId,
        },
        relations: ['conversation'],
      });

      if (!participant) {
        throw new BadRequestException(
          'You are not an active member of this conversation.',
        );
      }

      // Get messages with organization filter
      const rawMessages = await this.messageRepository.find({
        where: {
          conversationId,
          organization_id: organizationId,
        },
        order: { created_at: 'ASC' },
        relations: ['sender'],
      });

      const messagesDto = rawMessages.map((msg) => {
        const isMine = Number(msg.senderId) === Number(userFound.id);
        return plainToInstance(
          MessageResponseDto,
          {
            ...msg,
            isMine,
            time: this.formatTime(msg.created_at),
            createdAt: msg.created_at,
            status: 'read',
          },
          { excludeExtraneousValues: true },
        );
      });

      return { data: messagesDto, success: true, message: 'success' };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Failed to get messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get organization members who don't have a conversation with the user yet
   */
  async getUnchattedMembers(user: any, organizationId: string) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Verify user is in the organization
      const userOrg = await this.userOrganizationRepository.findOne({
        where: {
          user_id: userFound.id,
          organization_id: organizationId,
          is_active: true,
        },
      });

      if (!userOrg) {
        throw new HttpException(
          'You are not a member of this organization',
          HttpStatus.FORBIDDEN,
        );
      }

      // Get all active members in the organization
      const orgMembers = await this.userOrganizationRepository.find({
        where: {
          organization_id: organizationId,
          is_active: true,
        },
        relations: ['user'],
      });

      // Exclude self
      const otherMembers = orgMembers.filter((m) => m.user_id !== userFound.id);

      if (!otherMembers.length) {
        return {
          data: [],
          success: true,
          message: 'No other members in organization',
        };
      }

      // Get all member IDs that user has conversations with
      const chattedParticipants = await this.participantRepository
        .createQueryBuilder('participant')
        .select('participant.userId')
        .where((qb) => {
          const subQuery = qb
            .subQuery()
            .select('cp.conversationId')
            .from(ConversationParticipant, 'cp')
            .where('cp.userId = :userId', { userId: userFound.id })
            .andWhere('cp.organization_id = :organizationId', {
              organizationId,
            })
            .getQuery();
          return 'participant.conversationId IN ' + subQuery;
        })
        .andWhere('participant.userId != :userId', { userId: userFound.id })
        .andWhere('participant.organization_id = :organizationId', {
          organizationId,
        })
        .getRawMany();

      const chattedIds = new Set(
        chattedParticipants.map((p) => Number(p.participant_userId)),
      );

      // Filter members who haven't been chatted with yet
      const unchattedMembers = otherMembers
        .filter((m) => !chattedIds.has(Number(m.user_id)))
        .map((m) => ({
          id: m.user.id,
          name: m.user.fullName,
          avatar: m.user.avatar,
          email: m.user.email,
          online: m.user.logged_in,
          role: m.role,
        }));

      return {
        data: unchattedMembers,
        success: true,
        message: 'success',
      };
    } catch (err) {
      console.error('Error in getUnchattedMembers:', err);
      throw new HttpException(
        err?.message || 'Failed to get unchatted members',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Send a message
   */
  async sendMessage(
    user: any,
    conversationId: string,
    content: string,
    organizationId: string,
  ): Promise<{ data: MessageResponseDto; success: boolean; message: string }> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });

      // Verify user is in the organization
      const userOrg = await this.userOrganizationRepository.findOne({
        where: {
          user_id: userFound.id,
          organization_id: organizationId,
          is_active: true,
        },
      });

      if (!userOrg) {
        throw new HttpException(
          'You are not a member of this organization',
          HttpStatus.FORBIDDEN,
        );
      }

      // Verify active membership in conversation
      const participant = await this.participantRepository.findOne({
        where: {
          conversationId,
          userId: Number(userFound.id),
          isActive: true,
          organization_id: organizationId,
        },
        relations: [
          'conversation',
          'conversation.participants',
          'conversation.participants.user',
        ],
      });

      if (!participant) {
        throw new BadRequestException('You are not part of this conversation');
      }

      const conversation = participant.conversation;

      // Verify conversation belongs to organization
      if (conversation.organization_id !== organizationId) {
        throw new HttpException(
          'Conversation does not belong to this organization',
          HttpStatus.FORBIDDEN,
        );
      }

      // Create & persist the message
      const message = this.messageRepository.create({
        senderId: Number(userFound.id),
        sender: userFound,
        conversationId,
        conversation: conversation,
        content,
        messageType: 'text',
        organization_id: organizationId,
        organization,
      });

      const savedMessage = await this.messageRepository.save(message);

      // Update conversation timestamps
      await this.conversationRepository.update(conversationId, {
        lastMessageAt: new Date(),
      });

      // Transform to safe DTO
      const dto = plainToInstance(
        MessageResponseDto,
        {
          ...savedMessage,
          sender: userFound,
          isMine: true,
          time: this.formatTime(savedMessage.created_at),
          createdAt: savedMessage.created_at,
          status: 'sent' as const,
        },
        { excludeExtraneousValues: true },
      );

      // Emit via WebSocket
      this.messagesGateway.notifyNewMessage(conversationId, {
        id: savedMessage.id,
        content: savedMessage.content,
        senderId: savedMessage.senderId,
        sender: userFound,
        createdAt: savedMessage.created_at,
        time: this.formatTime(savedMessage.created_at),
        conversationId: savedMessage.conversationId,
        created_at: savedMessage.created_at,
        status: 'sent' as const,
        isMine: false,
      });

      // Send notifications to other participants
      const otherParticipants = conversation.participants.filter(
        (p) =>
          p.isActive &&
          Number(p.userId) !== Number(userFound.id) &&
          p.organization_id === organizationId,
      );

      for (const p of otherParticipants) {
        const recipient = await this.usersService.getUserAccountById(p.userId);
        if (!recipient) continue;

        const notificationPayload = {
          title: `${userFound.fullName} sent a message`,
          message: content.length > 50 ? content.slice(0, 47) + '...' : content,
          sender: userFound,
          recipient,
          type: NOTIFICATION_TYPES.PEER_MESSAGE,
        };

        await this.notificationService.createNotification(
          userFound,
          notificationPayload,
          organizationId
        );
      }

      return {
        data: dto,
        success: true,
        message: 'Message sent successfully',
      };
    } catch (err) {
      console.error('sendMessage error:', err);
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Failed to send message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private formatTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  }
}
