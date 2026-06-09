import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Message } from 'src/typeorm/entities/Message';
import { Brackets, In, Repository } from 'typeorm';
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
import { CreateMessageDto } from '../dto/create-message.dto';
import { MessageReadReceipt } from 'src/typeorm/entities/MessageReadReceipt';
import { MessageReaction } from 'src/typeorm/entities/MessageReaction';
import { MessageStar } from 'src/typeorm/entities/MessageStar';
import { Profile } from 'src/typeorm/entities/Profile';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { StorageService } from 'src/types/storage.interface';
import { MulterFile } from 'src/types/multer.types';
import { UpdateConversationPreferencesDto } from '../dto/update-conversation-preferences.dto';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';

@Injectable()
export class MessagesService {
  constructor(
    private usersService: UsersService,
    private notificationService: NotificationsService,
    private messagesGateway: MessagesGateway,
    @Inject('STORAGE_SERVICE')
    private readonly storageService: StorageService,

    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepository: Repository<ConversationParticipant>,
    @InjectRepository(MessageReaction)
    private readonly messageReactionRepository: Repository<MessageReaction>,
    @InjectRepository(MessageReadReceipt)
    private readonly messageReadReceiptRepository: Repository<MessageReadReceipt>,
    @InjectRepository(MessageStar)
    private readonly messageStarRepository: Repository<MessageStar>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectPeer)
    private readonly projectPeerRepository: Repository<ProjectPeer>,
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
          isDeleted: false,
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

      const response = await this.buildConversationResponse(
        conversations,
        userId,
        organizationId,
      );

      response.data = response.data.sort((left, right) => {
        const leftPinned = left.preferences?.isPinned ? 1 : 0;
        const rightPinned = right.preferences?.isPinned ? 1 : 0;
        if (leftPinned !== rightPinned) {
          return rightPinned - leftPinned;
        }

        const leftArchived = left.preferences?.isArchived ? 1 : 0;
        const rightArchived = right.preferences?.isArchived ? 1 : 0;
        if (leftArchived !== rightArchived) {
          return leftArchived - rightArchived;
        }

        return (
          new Date(right.lastMessageAt ?? right.updated_at).getTime() -
          new Date(left.lastMessageAt ?? left.updated_at).getTime()
        );
      });

      return response;
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
    const onlineStatusMap = await this.messagesGateway.getOnlineStatusMap(userIds);

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

    const unreadCountEntries = await Promise.all(
      conversations.map(async (conv) => {
        const participant = participants.find(
          (item) =>
            item.conversationId === conv.id &&
            Number(item.userId) === Number(userId),
        );

        const query = this.messageRepository
          .createQueryBuilder('message')
          .where('message.conversationId = :conversationId', {
            conversationId: conv.id,
          })
          .andWhere('message.organization_id = :organizationId', {
            organizationId,
          })
          .andWhere('message.senderId != :userId', { userId });

        if (participant?.lastReadAt) {
          query.andWhere('message.created_at > :lastReadAt', {
            lastReadAt: participant.lastReadAt,
          });
        }

        const unread = await query.getCount();
        return [conv.id, unread] as const;
      }),
    );
    const unreadCountMap = new Map<string, number>(unreadCountEntries);

    // Build enriched data
    const enrichedData = conversations.map((conv) => {
      const convParticipants = participants.filter(
        (p) => p.conversationId === conv.id,
      );
      const currentParticipant = convParticipants.find(
        (participant) => Number(participant.userId) === Number(userId),
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
      const peerOnline = peerUserId
        ? onlineStatusMap.get(Number(peerUserId)) ?? false
        : false;

      return {
        id: conv.id,
        type: conv.type,
        name: displayName,
        avatar: displayAvatar,
        online: conv.type === 'direct' ? peerOnline : undefined,
        peer: peer
          ? {
              id: peer.id,
              fullName: peer.fullName ?? '',
              first_name: peer.first_name,
              last_name: peer.last_name,
              username: peer.username,
              email: peer.email,
              avatar: peer.avatar,
              logged_in: peerOnline,
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
        unread: unreadCountMap.get(conv.id) ?? 0,
        participantId: currentParticipant?.id,
        preferences: currentParticipant
          ? {
              isMuted: currentParticipant.isMuted,
              isPinned: currentParticipant.isPinned,
              pinnedAt: currentParticipant.pinnedAt,
              isArchived: currentParticipant.isArchived,
              archivedAt: currentParticipant.archivedAt,
              isDeleted: currentParticipant.isDeleted,
              deletedAt: currentParticipant.deletedAt,
              lastReadAt: currentParticipant.lastReadAt,
              lastReadMessageId: currentParticipant.lastReadMessageId,
              draft: currentParticipant.draft,
            }
          : null,
        lastMessageAt: conv.lastMessageAt,
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
        .andWhere('cp1.isDeleted = false')
        .andWhere('cp1.organization_id = :organizationId', { organizationId })
        .getMany();

      const userConvIds = userConversations.map((p) => p.conversationId);

      const deletedConversationParticipant = await this.participantRepository
        .createQueryBuilder('cp1')
        .innerJoin(
          ConversationParticipant,
          'cp2',
          'cp2.conversationId = cp1.conversationId AND cp2.userId = :memberId AND cp2.isActive = true AND cp2.organization_id = :organizationId',
          { memberId: memberIdNum, organizationId },
        )
        .innerJoinAndSelect('cp1.conversation', 'conversation')
        .where('cp1.userId = :userId', { userId })
        .andWhere('cp1.isActive = true')
        .andWhere('cp1.isDeleted = true')
        .andWhere('cp1.organization_id = :organizationId', { organizationId })
        .andWhere('conversation.type = :conversationType', {
          conversationType: 'direct',
        })
        .getOne();

      if (deletedConversationParticipant?.conversation) {
        deletedConversationParticipant.isDeleted = false;
        deletedConversationParticipant.deletedAt = null;
        deletedConversationParticipant.isArchived = false;
        deletedConversationParticipant.archivedAt = null;
        await this.participantRepository.save(deletedConversationParticipant);

        const restoredConversation = deletedConversationParticipant.conversation;
        const restoredResponse = await this.buildConversationResponse(
          [restoredConversation],
          userId,
          organizationId,
        );

        return {
          data: restoredResponse.data[0],
          success: true,
          message: 'Conversation restored successfully',
        };
      }

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
            const peerOnline = peer?.id
              ? await this.messagesGateway.isUserOnline(Number(peer.id))
              : false;

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
                online: peerOnline,
                peer: peer
                  ? {
                      id: peer.id,
                      fullName: peer.fullName ?? '',
                      first_name: peer.first_name,
                      last_name: peer.last_name,
                      username: peer.username,
                      email: peer.email,
                      avatar: peer.avatar,
                      logged_in: peerOnline,
                    }
                  : null,
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

      const memberOnline = await this.messagesGateway.isUserOnline(
        Number(memberUser?.id),
      );

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
          online: memberOnline,
          peer: {
            id: memberUser.id,
            fullName: memberUser.fullName ?? '',
            first_name: memberUser.first_name,
            last_name: memberUser.last_name,
            username: memberUser.username,
            email: memberUser.email,
            avatar: memberUser.avatar,
            logged_in: memberOnline,
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
      const rawMessages = await this.messageRepository
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .leftJoinAndSelect('message.reactions', 'reactions')
        .leftJoinAndSelect('message.stars', 'stars')
        .leftJoinAndSelect('message.readReceipts', 'readReceipts')
        .leftJoinAndSelect('message.replyTo', 'replyTo')
        .leftJoinAndSelect('replyTo.sender', 'replyToSender')
        .where('message.conversationId = :conversationId', { conversationId })
        .andWhere(
          new Brackets((qb) => {
            qb.where('message.organization_id = :organizationId', {
              organizationId,
            }).orWhere('message.organization_id IS NULL');
          }),
        )
        .orderBy('message.created_at', 'ASC')
        .getMany();

      const messagesDto = rawMessages.map((msg) =>
        this.toMessageResponse(msg, Number(userFound.id)),
      );

      return { data: messagesDto, success: true, message: 'success' };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Failed to get messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getConversationContext(
    user: any,
    conversationId: string,
    organizationId: string,
  ) {
    const userFound = await this.usersService.getUserAccountById(user.userId);
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

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

    const participants = await this.participantRepository.find({
      where: {
        conversationId,
        isActive: true,
        organization_id: organizationId,
      },
      relations: ['conversation', 'user'],
    });

    const currentParticipant = participants.find(
      (participant) => Number(participant.userId) === Number(userFound.id),
    );

    if (!currentParticipant) {
      throw new BadRequestException('You are not part of this conversation');
    }

    const conversation = currentParticipant.conversation;
    if (!conversation || conversation.type !== 'direct') {
      throw new BadRequestException(
        'Conversation context is currently available for direct chats only.',
      );
    }

    const peerParticipant = participants.find(
      (participant) => Number(participant.userId) !== Number(userFound.id),
    );

    if (!peerParticipant?.user) {
      throw new NotFoundException('Peer was not found for this conversation');
    }

    const peerUser = peerParticipant.user;
    const peerProfile = await this.profileRepository.findOne({
      where: {
        user: { id: Number(peerUser.id) },
      },
    });

    const sharedProjects = await this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.projectPeers', 'projectPeer')
      .where('project.organization_id = :organizationId', { organizationId })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            `project.user_id = :currentUserId AND EXISTS (
              SELECT 1
              FROM project_peers peer_match
              WHERE peer_match.project_id = project.id
                AND peer_match.user_id = :peerUserId
                AND peer_match.organization_id = :organizationId
                AND peer_match.status = :peerStatus
                AND peer_match.is_confirmed = true
            )`,
            {
              currentUserId: Number(userFound.id),
              peerUserId: Number(peerUser.id),
              organizationId,
              peerStatus: ProjectPeerStatus.CONNECTED,
            },
          )
            .orWhere(
              `project.user_id = :peerUserId AND EXISTS (
                SELECT 1
                FROM project_peers current_match
                WHERE current_match.project_id = project.id
                  AND current_match.user_id = :currentUserId
                  AND current_match.organization_id = :organizationId
                  AND current_match.status = :peerStatus
                  AND current_match.is_confirmed = true
              )`,
              {
                currentUserId: Number(userFound.id),
                peerUserId: Number(peerUser.id),
                organizationId,
                peerStatus: ProjectPeerStatus.CONNECTED,
              },
            )
            .orWhere(
              `EXISTS (
                SELECT 1
                FROM project_peers current_match
                WHERE current_match.project_id = project.id
                  AND current_match.user_id = :currentUserId
                  AND current_match.organization_id = :organizationId
                  AND current_match.status = :peerStatus
                  AND current_match.is_confirmed = true
              )
              AND EXISTS (
                SELECT 1
                FROM project_peers peer_match
                WHERE peer_match.project_id = project.id
                  AND peer_match.user_id = :peerUserId
                  AND peer_match.organization_id = :organizationId
                  AND peer_match.status = :peerStatus
                  AND peer_match.is_confirmed = true
              )`,
              {
                currentUserId: Number(userFound.id),
                peerUserId: Number(peerUser.id),
                organizationId,
                peerStatus: ProjectPeerStatus.CONNECTED,
              },
            );
        }),
      )
      .orderBy('project.updated_at', 'DESC')
      .getMany();

    const peerOnline = await this.messagesGateway.isUserOnline(Number(peerUser.id));

    return {
      success: true,
      message: 'success',
      data: {
        conversationId,
        peer: {
          id: peerUser.id,
          fullName:
            peerUser.fullName ||
            `${peerUser.first_name || ''} ${peerUser.last_name || ''}`.trim(),
          first_name: peerUser.first_name,
          last_name: peerUser.last_name,
          username: peerUser.username,
          email: peerUser.email,
          avatar: peerUser.avatar,
          role: peerUser.role,
          online: peerOnline,
          phoneNumber: peerProfile?.phonenumber || null,
          country: peerProfile?.country || null,
          state: peerProfile?.state || null,
          address: peerProfile?.address || null,
          memberSince: peerUser.created_at,
        },
        about: {
          email: peerUser.email,
          phoneNumber: peerProfile?.phonenumber || null,
          country: peerProfile?.country || null,
          state: peerProfile?.state || null,
          address: peerProfile?.address || null,
          role: peerUser.role,
          username: peerUser.username || null,
        },
        sharedProjects: sharedProjects.slice(0, 6).map((project) => ({
          id: project.id,
          title: project.title,
          description: project.description,
          status: project.status,
          color: project.color,
          icon: project.icon,
          updatedAt: project.updated_at,
        })),
      },
    };
  }

  async updateConversationPreferences(
    user: any,
    conversationId: string,
    organizationId: string,
    payload: UpdateConversationPreferencesDto,
  ) {
    const userFound = await this.usersService.getUserAccountById(user.userId);
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

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

    const participant = await this.participantRepository.findOne({
      where: {
        conversationId,
        userId: Number(userFound.id),
        isActive: true,
        organization_id: organizationId,
      },
      relations: ['conversation'],
    });

    if (!participant) {
      throw new BadRequestException('You are not part of this conversation');
    }

    const now = new Date();

    if (typeof payload.isPinned === 'boolean') {
      participant.isPinned = payload.isPinned;
      participant.pinnedAt = payload.isPinned ? now : null;
    }

    if (typeof payload.isArchived === 'boolean') {
      participant.isArchived = payload.isArchived;
      participant.archivedAt = payload.isArchived ? now : null;
    }

    if (typeof payload.isDeleted === 'boolean') {
      participant.isDeleted = payload.isDeleted;
      participant.deletedAt = payload.isDeleted ? now : null;
    }

    const savedParticipant = await this.participantRepository.save(participant);

    return {
      success: true,
      message: 'Conversation preferences updated successfully',
      data: {
        conversationId,
        preferences: {
          isMuted: savedParticipant.isMuted,
          isPinned: savedParticipant.isPinned,
          pinnedAt: savedParticipant.pinnedAt,
          isArchived: savedParticipant.isArchived,
          archivedAt: savedParticipant.archivedAt,
          isDeleted: savedParticipant.isDeleted,
          deletedAt: savedParticipant.deletedAt,
          lastReadAt: savedParticipant.lastReadAt,
          lastReadMessageId: savedParticipant.lastReadMessageId,
          draft: savedParticipant.draft,
        },
      },
    };
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
            .andWhere('cp.isActive = true')
            .andWhere('cp.isDeleted = false')
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
          online: false,
          role: m.role,
        }));

      const unchattedMemberIds = unchattedMembers.map((member) => Number(member.id));
      const onlineStatusMap = await this.messagesGateway.getOnlineStatusMap(
        unchattedMemberIds,
      );

      const enrichedMembers = unchattedMembers.map((member) => ({
        ...member,
        online: onlineStatusMap.get(Number(member.id)) ?? false,
      }));

      return {
        data: enrichedMembers,
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
    payload: CreateMessageDto,
    organizationId: string,
  ): Promise<{ data: MessageResponseDto; success: boolean; message: string }> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const content = payload.content?.trim() ?? '';
      const firstAttachment = payload.attachments?.[0];

      if (!content && !firstAttachment) {
        throw new BadRequestException(
          'A message must include text content or at least one attachment.',
        );
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
          conversationId: payload.conversationId,
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

      if (payload.clientMessageId) {
        const existingMessage = await this.messageRepository.findOne({
          where: {
            senderId: Number(userFound.id),
            clientMessageId: payload.clientMessageId,
            organization_id: organizationId,
          },
          relations: [
            'sender',
            'reactions',
            'readReceipts',
            'replyTo',
            'replyTo.sender',
          ],
        });

        if (existingMessage) {
          return {
            data: this.toMessageResponse(existingMessage, Number(userFound.id)),
            success: true,
            message: 'Message already processed',
          };
        }
      }

      if (payload.replyToId) {
        const replyTarget = await this.messageRepository.findOne({
          where: {
            id: payload.replyToId,
            conversationId: payload.conversationId,
            organization_id: organizationId,
          },
        });

        if (!replyTarget) {
          throw new BadRequestException(
            'Reply target was not found in this conversation.',
          );
        }
      }

      // Create & persist the message
      const message = this.messageRepository.create({
        senderId: Number(userFound.id),
        sender: userFound,
        conversationId: payload.conversationId,
        conversation: conversation,
        content: content || null,
        clientMessageId: payload.clientMessageId ?? null,
        fileUrl: firstAttachment?.fileUrl ?? null,
        fileType: firstAttachment?.fileType ?? null,
        messageType: firstAttachment ? this.resolveMessageType(firstAttachment.fileType) : 'text',
        replyToId: payload.replyToId ?? null,
        organization_id: organizationId,
        organization,
      });

      const savedMessage = await this.messageRepository.save(message);

      // Update conversation timestamps
      await this.conversationRepository.update(payload.conversationId, {
        lastMessageAt: new Date(),
      });

      await this.participantRepository.update(participant.id, {
        lastReadAt: new Date(),
        lastReadMessageId: savedMessage.id,
      });

      // Transform to safe DTO
      const dto = this.toMessageResponse(
        {
          ...savedMessage,
          sender: userFound,
          reactions: [],
          readReceipts: [],
          replyTo: null,
        } as Message,
        Number(userFound.id),
      );

      // Emit via WebSocket
      this.messagesGateway.notifyNewMessage(payload.conversationId, dto);

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
          message: content
            ? content.length > 50
              ? content.slice(0, 47) + '...'
              : content
            : 'Sent an attachment',
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

  async markConversationRead(
    user: any,
    conversationId: string,
    organizationId: string,
    lastReadMessageId?: string,
  ) {
    const userFound = await this.usersService.getUserAccountById(user.userId);
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

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

    const participant = await this.participantRepository.findOne({
      where: {
        conversationId,
        userId: Number(userFound.id),
        isActive: true,
        organization_id: organizationId,
      },
    });

    if (!participant) {
      throw new BadRequestException('You are not part of this conversation');
    }

    let targetMessage: Message | null = null;

    if (lastReadMessageId) {
      targetMessage = await this.messageRepository.findOne({
        where: {
          id: lastReadMessageId,
          conversationId,
          organization_id: organizationId,
        },
      });

      if (!targetMessage) {
        throw new BadRequestException(
          'The target read message was not found in this conversation.',
        );
      }
    } else {
      targetMessage = await this.messageRepository.findOne({
        where: {
          conversationId,
          organization_id: organizationId,
        },
        order: {
          created_at: 'DESC',
        },
      });
    }

    if (!targetMessage) {
      await this.participantRepository.update(participant.id, {
        lastReadAt: new Date(),
      });

      return {
        success: true,
        message: 'Conversation marked as read',
        data: {
          conversationId,
          lastReadMessageId: participant.lastReadMessageId ?? null,
          unread: 0,
        },
      };
    }

    const unreadMessages = await this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('message.organization_id = :organizationId', { organizationId })
      .andWhere('message.senderId != :userId', { userId: Number(userFound.id) })
      .andWhere('message.created_at <= :targetCreatedAt', {
        targetCreatedAt: targetMessage.created_at,
      })
      .andWhere(
        participant.lastReadAt
          ? 'message.created_at > :lastReadAt'
          : '1 = 1',
        participant.lastReadAt
          ? { lastReadAt: participant.lastReadAt }
          : undefined,
      )
      .getMany();

    if (unreadMessages.length > 0) {
      const unreadMessageIds = unreadMessages.map((message) => message.id);
      const existingReceipts = await this.messageReadReceiptRepository.find({
        where: {
          userId: Number(userFound.id),
          messageId: In(unreadMessageIds),
        },
        select: ['messageId'],
      });
      const existingMessageIds = new Set(
        existingReceipts.map((receipt) => receipt.messageId),
      );
      const readAt = new Date();
      const receiptsToInsert = unreadMessages
        .filter((message) => !existingMessageIds.has(message.id))
        .map((message) =>
          this.messageReadReceiptRepository.create({
            messageId: message.id,
            userId: Number(userFound.id),
            readAt,
          }),
        );

      if (receiptsToInsert.length > 0) {
        await this.messageReadReceiptRepository.save(receiptsToInsert);
      }
    }

    await this.participantRepository.update(participant.id, {
      lastReadAt: new Date(),
      lastReadMessageId: targetMessage.id,
    });

    return {
      success: true,
      message: 'Conversation marked as read',
      data: {
        conversationId,
        lastReadMessageId: targetMessage.id,
        unread: 0,
      },
    };
  }

  async uploadAttachment(
    user: any,
    file: MulterFile | undefined,
    organizationId: string,
    requestedFileName?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Attachment file is required.');
    }

    const userFound = await this.usersService.getUserAccountById(user.userId);
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

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

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File too large. Max size is 10MB.');
    }

    const safeFileName = (requestedFileName || file.originalname || 'attachment')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 180);
    const storagePath = [
      'chat',
      organizationId,
      String(userFound.id),
      `${Date.now()}-${safeFileName}`,
    ].join('/');

    const fileUrl = await this.storageService.uploadFile(file, storagePath);

    return {
      success: true,
      message: 'Attachment uploaded successfully',
      data: {
        fileUrl,
        fileType: file.mimetype || null,
        fileName: file.originalname || safeFileName,
        size: file.size,
      },
    };
  }

  async addReaction(
    user: any,
    messageId: string,
    emoji: string,
    organizationId: string,
  ) {
    const userFound = await this.usersService.getUserAccountById(user.userId);
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

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

    const message = await this.messageRepository.findOne({
      where: {
        id: messageId,
        organization_id: organizationId,
      },
      relations: ['sender', 'reactions', 'readReceipts', 'replyTo', 'replyTo.sender'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const participant = await this.participantRepository.findOne({
      where: {
        conversationId: message.conversationId,
        userId: Number(userFound.id),
        isActive: true,
        organization_id: organizationId,
      },
    });

    if (!participant) {
      throw new BadRequestException('You are not part of this conversation');
    }

    const existingReactions = await this.messageReactionRepository.find({
      where: {
        messageId: message.id,
        userId: Number(userFound.id),
        emoji,
      },
    });

    if (existingReactions.length > 0) {
      await this.messageReactionRepository.remove(existingReactions);

      this.messagesGateway.notifyReactionRemoved(message.conversationId, {
        messageId: message.id,
        reactionIds: existingReactions.map((reaction) => reaction.id),
        emoji,
        userId: Number(userFound.id),
      });

      return {
        success: true,
        message: 'Reaction removed successfully',
        data: {
          messageId: message.id,
          toggled: 'removed',
          emoji,
          userId: Number(userFound.id),
          reactionIds: existingReactions.map((reaction) => reaction.id),
        },
      };
    }

    const reaction = this.messageReactionRepository.create({
      messageId: message.id,
      message,
      userId: Number(userFound.id),
      user: userFound,
      emoji,
    });

    const savedReaction = await this.messageReactionRepository.save(reaction);

    this.messagesGateway.notifyReactionAdded(message.conversationId, {
      messageId: message.id,
      reaction: {
        id: savedReaction.id,
        emoji: savedReaction.emoji,
        userId: Number(savedReaction.userId),
        createdAt: savedReaction.created_at,
      },
    });

    return {
      success: true,
      message: 'Reaction added successfully',
      data: {
        messageId: message.id,
        toggled: 'added',
        reaction: {
          id: savedReaction.id,
          emoji: savedReaction.emoji,
          userId: Number(savedReaction.userId),
          createdAt: savedReaction.created_at,
        },
      },
    };
  }

  async toggleMessageStar(user: any, messageId: string, organizationId: string) {
    const userFound = await this.usersService.getUserAccountById(user.userId);
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

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

    const message = await this.messageRepository.findOne({
      where: {
        id: messageId,
        organization_id: organizationId,
      },
      relations: [
        'sender',
        'reactions',
        'stars',
        'readReceipts',
        'replyTo',
        'replyTo.sender',
      ],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const participant = await this.participantRepository.findOne({
      where: {
        conversationId: message.conversationId,
        userId: Number(userFound.id),
        isActive: true,
        organization_id: organizationId,
      },
    });

    if (!participant) {
      throw new BadRequestException('You are not part of this conversation');
    }

    const existingStar = await this.messageStarRepository.findOne({
      where: {
        messageId: message.id,
        userId: Number(userFound.id),
      },
    });

    if (existingStar) {
      await this.messageStarRepository.remove(existingStar);

      return {
        success: true,
        message: 'Message unstarred successfully',
        data: {
          messageId: message.id,
          conversationId: message.conversationId,
          isStarred: false,
        },
      };
    }

    const star = this.messageStarRepository.create({
      messageId: message.id,
      message,
      userId: Number(userFound.id),
      user: userFound,
      organization_id: organizationId,
    });

    await this.messageStarRepository.save(star);

    return {
      success: true,
      message: 'Message starred successfully',
      data: {
        messageId: message.id,
        conversationId: message.conversationId,
        isStarred: true,
      },
    };
  }

  private toMessageResponse(message: Message, currentUserId: number) {
    const isMine = Number(message.senderId) === Number(currentUserId);
    const readBy =
      message.readReceipts?.map((receipt) => ({
        userId: Number(receipt.userId),
        readAt: receipt.readAt,
      })) ?? [];
    const deliveryStatus = isMine
      ? readBy.length > 0
        ? 'read'
        : 'sent'
      : 'read';

    return plainToInstance(
      MessageResponseDto,
      {
        ...message,
        clientMessageId: message.clientMessageId ?? null,
        conversationId: message.conversationId,
        content: message.content ?? null,
        attachments: this.buildAttachments(message),
        replyToId: message.replyToId ?? null,
        replyTo: message.replyTo
          ? {
              id: message.replyTo.id,
              content: message.replyTo.content ?? null,
              messageType: message.replyTo.messageType,
              createdAt: message.replyTo.created_at,
              sender: message.replyTo.sender,
            }
          : null,
        createdAt: message.created_at,
        updatedAt: message.updated_at,
        isMine,
        time: this.formatTime(message.created_at),
        deliveryStatus,
        status: deliveryStatus,
        reactions:
          message.reactions?.map((reaction) => ({
            id: reaction.id,
            emoji: reaction.emoji,
            userId: Number(reaction.userId),
            createdAt: reaction.created_at,
          })) ?? [],
        readBy,
        isStarred:
          message.stars?.some(
            (star) => Number(star.userId) === Number(currentUserId),
          ) ?? false,
      },
      { excludeExtraneousValues: true },
    );
  }

  private buildAttachments(message: Pick<Message, 'fileUrl' | 'fileType'>) {
    if (!message.fileUrl) {
      return [];
    }

    const fileName = message.fileUrl.split('/').pop() ?? null;

    return [
      {
        fileUrl: message.fileUrl,
        fileType: message.fileType ?? null,
        fileName,
      },
    ];
  }

  private resolveMessageType(fileType?: string | null) {
    if (!fileType) {
      return 'file';
    }

    if (fileType.startsWith('image/')) {
      return 'image';
    }

    if (fileType.startsWith('video/')) {
      return 'video';
    }

    return 'file';
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
