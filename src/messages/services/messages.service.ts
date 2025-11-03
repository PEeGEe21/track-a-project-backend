import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UpdateMessageDto } from '../dto/update-message.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Message } from 'src/typeorm/entities/Message';
import { In, Repository } from 'typeorm';
import { Conversation } from 'src/typeorm/entities/Conversation';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { ConversationParticipant } from 'src/typeorm/entities/ConversationParticipant';
import { UserPeerStatus } from 'src/utils/constants/userPeerEnums';
import { UsersService } from 'src/users/services/users.service';
import { MessageResponseDto } from '../dto/message-response.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class MessagesService {
  constructor(
    private usersService: UsersService,

    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepository: Repository<ConversationParticipant>,
    @InjectRepository(UserPeer)
    private readonly peerRepository: Repository<UserPeer>,
  ) {}

  /**
   * Get all conversations for the current user
   */
  async getUserConversations(user: any) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = Number(userFound.id);
      console.log(
        '🔍 Looking for conversations for userId:',
        userId,
        typeof userId,
      );

      // ✅ First, let's check if participants exist for this user
      const userParticipants = await this.participantRepository.find({
        where: { userId },
      });

      console.log('🔍 Total participants for user:', userParticipants.length);
      console.log('🔍 Participant details:', userParticipants);

      // ✅ Now try the original query with debugging
      // const conversations = await this.conversationRepository
      //   .createQueryBuilder('conversation')
      //   .innerJoin('conversation.participants', 'participant')
      //   .where('participant.userId = :userId', { userId })
      //   .andWhere('participant.isActive = :isActive', { isActive: true })
      //   .orderBy('conversation.lastMessageAt', 'DESC')
      //   .printSql() // This will print the SQL query
      //   .getMany();

      const activeParticipants = await this.participantRepository.find({
        where: { userId, isActive: true },
        select: ['conversationId'],
      });

      const conversationIds = activeParticipants.map((p) => p.conversationId);

      if (conversationIds.length === 0) {
        return { data: [], success: true, message: 'No conversations found' };
      }

      const conversations = await this.conversationRepository.find({
        where: { id: In(conversationIds) },
        order: { lastMessageAt: 'DESC' },
      });

      console.log('✅ Conversations found:', conversations.length);

      if (!conversations.length) {
        // Let's try a different approach
        console.log('🔍 Trying alternative query...');

        const participantConvIds = userParticipants
          .filter((p) => p.isActive)
          .map((p) => p.conversationId);

        console.log(
          '🔍 Conversation IDs from participants:',
          participantConvIds,
        );

        console.log(
          'typeof',
          typeof userParticipants[0].userId,
          userParticipants[0].userId,
        );

        if (participantConvIds.length > 0) {
          const conversationsAlt = await this.conversationRepository.find({
            where: {
              id: In(participantConvIds),
            },
            order: {
              lastMessageAt: 'DESC',
            },
          });

          console.log(
            '✅ Conversations found (alternative):',
            conversationsAlt.length,
          );

          if (conversationsAlt.length > 0) {
            // Continue with the rest of the logic using conversationsAlt
            return await this.buildConversationResponse(
              conversationsAlt,
              userId,
            );
          }
        }

        return {
          data: [],
          success: true,
          message: 'No conversations found',
        };
      }

      return await this.buildConversationResponse(conversations, userId);
    } catch (err) {
      console.error('❌ Error in getUserConversations:', err);
      throw new HttpException(
        'Failed to get conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Extract the response building logic
  private async buildConversationResponse(
    conversations: Conversation[],
    userId: number,
  ) {
    const conversationIds = conversations.map((c) => c.id);

    // Load participants
    const participants = await this.participantRepository.find({
      where: {
        conversationId: In(conversationIds),
        isActive: true,
      },
    });

    console.log('✅ Participants loaded:', participants.length);

    // Get unique user IDs and load users manually
    const userIds = [...new Set(participants.map((p) => Number(p.userId)))];
    console.log('✅ Unique user IDs:', userIds);

    const users = await this.usersService.getUsersByIds(userIds);
    console.log('✅ Users loaded:', users.length);

    // Create a map for quick user lookup
    const userMap = new Map(users.map((u) => [Number(u.id), u]));

    // Get last message for each conversation
    const lastMessages = await this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId IN (:...ids)', { ids: conversationIds })
      .andWhere(
        'message.id IN (SELECT MAX(id) FROM messages WHERE conversationId IN (:...ids) GROUP BY conversationId)',
      )
      .setParameter('ids', conversationIds)
      .getMany();

    console.log('✅ Last messages loaded:', lastMessages.length);

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

  async getUserConversations1(user: any) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = Number(userFound.id);

      // ✅ Step 1: Get all conversations for the user
      const conversations = await this.conversationRepository
        .createQueryBuilder('conversation')
        .innerJoin('conversation.participants', 'participant')
        .where('participant.userId = :userId', { userId })
        .andWhere('participant.isActive = :isActive', { isActive: true })
        .orderBy('conversation.lastMessageAt', 'DESC')
        .getMany();

      console.log('✅ Conversations found:', conversations.length);

      if (!conversations.length) {
        return {
          data: [],
          success: true,
          message: 'No conversations found',
        };
      }

      const conversationIds = conversations.map((c) => c.id);

      // ✅ Step 2: Load participants (without relations first)
      const participants = await this.participantRepository.find({
        where: {
          conversationId: In(conversationIds),
          isActive: true,
        },
      });

      console.log('✅ Participants loaded:', participants.length);

      // ✅ Step 3: Get unique user IDs and load users manually
      const userIds = [...new Set(participants.map((p) => p.userId))];
      console.log('✅ Unique user IDs:', userIds);

      const users = await this.usersService.getUsersByIds(userIds);
      console.log('✅ Users loaded:', users.length);

      // Create a map for quick user lookup
      const userMap = new Map(users.map((u) => [Number(u.id), u]));

      // ✅ Step 4: Get last message for each conversation
      const lastMessages = await this.messageRepository
        .createQueryBuilder('message')
        .where('message.conversationId IN (:...ids)', { ids: conversationIds })
        .andWhere(
          'message.id IN (SELECT MAX(id) FROM messages WHERE conversationId IN (:...ids) GROUP BY conversationId)',
        )
        .setParameter('ids', conversationIds)
        .getMany();

      console.log('✅ Last messages loaded:', lastMessages.length);

      // ✅ Step 5: Build enriched data
      const enrichedData = conversations.map((conv) => {
        // Get participants for this conversation
        const convParticipants = participants.filter(
          (p) => p.conversationId === conv.id,
        );

        console.log(
          `✅ Conv ${conv.id} has ${convParticipants.length} participants`,
        );

        // Find the peer user ID
        const peerUserId = convParticipants
          .map((p) => p.userId)
          .find((id) => Number(id) !== userId);

        // Get peer from userMap
        const peer = peerUserId ? userMap.get(Number(peerUserId)) : null;

        console.log('✅ Peer found:', peer?.id, peer?.first_name);

        // Get last message
        const lastMessage = lastMessages.find(
          (m) => m.conversationId === conv.id,
        );

        // Display name based on conversation type
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
          unread: 0, // TODO: Calculate from lastReadAt
          created_at: conv.created_at,
          updated_at: conv.updated_at,
        };
      });

      return {
        data: enrichedData,
        success: true,
        message: 'success',
      };
    } catch (err) {
      console.error('❌ Error in getUserConversations:', err);
      throw new HttpException(
        'Failed to get conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserConversations2(user: any) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // ✅ Step 1: Get all conversations for the user
      const conversations = await this.conversationRepository
        .createQueryBuilder('conversation')
        .innerJoin('conversation.participants', 'participant')
        .where('participant.userId = :userId', { userId: userFound.id })
        .andWhere('participant.isActive = :isActive', { isActive: true })
        .orderBy('conversation.lastMessageAt', 'DESC')
        .getMany();

      if (!conversations.length) {
        return {
          data: [],
          success: true,
          message: 'No conversations found',
        };
      }

      const conversationIds = conversations.map((c) => c.id);

      // ✅ Step 2: Load participants with users for each conversation
      const participantsWithUsers = await this.participantRepository.find({
        where: {
          conversationId: In(conversationIds),
          isActive: true,
        },
        relations: ['user'],
      });

      console.log('✅ Participants loaded:', participantsWithUsers.length);

      // ✅ Step 3: Get last message for each conversation
      const lastMessages = await this.messageRepository
        .createQueryBuilder('message')
        .where('message.conversationId IN (:...ids)', { ids: conversationIds })
        .andWhere(
          'message.id IN (SELECT MAX(id) FROM messages WHERE conversationId IN (:...ids) GROUP BY conversationId)',
        )
        .setParameter('ids', conversationIds)
        .getMany();

      console.log('✅ Last messages loaded:', lastMessages.length);

      // ✅ Step 4: Build enriched data
      const enrichedData = conversations.map((conv) => {
        // Get participants for this conversation
        const convParticipants = participantsWithUsers.filter(
          (p) => p.conversationId === conv.id,
        );

        console.log(
          `✅ Conv ${conv.id} has ${convParticipants.length} participants`,
        );

        // Find the peer (other user)
        const peer = convParticipants
          .map((p) => p.user)
          .find((u) => u?.id !== userFound.id);

        console.log('✅ Peer found:', peer?.id, peer?.first_name);

        // Get last message
        const lastMessage = lastMessages.find(
          (m) => m.conversationId === conv.id,
        );

        // Display name based on conversation type
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
          peer,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content || '',
                time: this.formatTime(lastMessage.created_at),
                senderId: lastMessage.senderId,
              }
            : null,
          unread: 0, // TODO: Calculate from lastReadAt
          created_at: conv.created_at,
          updated_at: conv.updated_at,
        };
      });

      return {
        data: enrichedData,
        success: true,
        message: 'success',
      };
    } catch (err) {
      console.error('❌ Error in getUserConversations:', err);
      throw new HttpException(
        'Failed to get conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Helper method
  private formatTime2(date: Date): string {
    if (!date) return '';

    const now = new Date();
    const messageDate = new Date(date);
    const diff = now.getTime() - messageDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
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

  // async getUserConversations(user: any) {
  //   try {
  //     const userFound = await this.usersService.getUserAccountById(user.userId);
  //     if (!userFound) {
  //       throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
  //     }

  //     const data = await this.conversationRepository
  //       .createQueryBuilder('conversation')
  //       .leftJoinAndSelect('conversation.participants', 'participant')
  //       .leftJoinAndSelect('participant.user', 'user')
  //       .leftJoin(
  //         (qb) =>
  //           qb
  //             .select('m.id', 'id')
  //             .addSelect('m.content', 'content')
  //             .addSelect('m.created_at', 'created_at')
  //             .addSelect('m.senderId', 'senderId')
  //             .addSelect('m.conversationId', 'conversationId')
  //             .from(Message, 'm')
  //             .where(
  //               'm.id IN (SELECT MAX(id) FROM messages GROUP BY conversationId)',
  //             ),
  //         'last_message',
  //         'last_message.conversationId = conversation.id',
  //       )
  //       .addSelect('last_message.id', 'lastMessageId')
  //       .addSelect('last_message.content', 'lastMessageContent')
  //       .addSelect('last_message.created_at', 'lastMessageAt')
  //       .addSelect('last_message.senderId', 'lastMessageSenderId')
  //       .where((qb) => {
  //         const subQuery = qb
  //           .subQuery()
  //           .select('cp.conversationId')
  //           .from(ConversationParticipant, 'cp')
  //           .where('cp.userId = :userId')
  //           .andWhere('cp.isActive = :isActive', { isActive: true })
  //           .getQuery();
  //         return 'conversation.id IN ' + subQuery;
  //       })
  //       .setParameter('userId', userFound.id)
  //       .orderBy('conversation.lastMessageAt', 'DESC')
  //       .getRawAndEntities();

  //     // 🔍 DEBUG: Check what's in entities and raw
  //     console.log('🔍 Data entities:', JSON.stringify(data.entities, null, 2));
  //     console.log('🔍 Data raw:', data.raw);

  //     const enrichedData = data.entities.map((conv) => {
  //       const raw = data.raw.find((r) => r.conversation_id === conv.id);

  //       // 🔍 DEBUG: Log each conversation
  //       console.log('🔍 Conversation ID:', conv.id);
  //       console.log('🔍 Participants:', conv.participants);

  //       // 🔍 DEBUG: Check each participant
  //       if (conv.participants) {
  //         conv.participants.forEach((p, idx) => {
  //           console.log(`🔍 Participant ${idx}:`, {
  //             id: p.id,
  //             userId: p.userId,
  //             hasUser: !!p.user,
  //             userName: p.user?.first_name,
  //           });
  //         });
  //       }

  //       // Find peer user (the one that's not the logged-in user)
  //       const peer = conv.participants
  //         ?.map((p) => p.user)
  //         ?.find((u) => {
  //           console.log('🔍 Checking user:', u?.id, 'vs', userFound.id);
  //           return u?.id !== userFound.id;
  //         });

  //       console.log('🔍 Found peer:', peer);

  //       // ✅ For direct chats, use peer's name. For groups, use group name
  //       const displayName = conv.type === 'direct'
  //         ? peer?.fullName || `${peer?.first_name} ${peer?.last_name}`.trim() || peer?.username || 'Unknown User'
  //         : conv.name || 'Unnamed Group';

  //       const displayAvatar = conv.type === 'direct'
  //         ? peer?.avatar || ''
  //         : conv.avatar || '';

  //       return {
  //         id: conv.id,
  //         type: conv.type,
  //         name: displayName,
  //         avatar: displayAvatar,
  //         online: conv.type === 'direct' ? (peer?.logged_in || false) : undefined,
  //         peer,
  //         lastMessage: raw
  //           ? {
  //               id: raw.lastMessageId,
  //               content: raw.lastMessageContent || '',
  //               time: this.formatTime(raw.lastMessageAt),
  //               senderId: raw.lastMessageSenderId,
  //             }
  //           : null,
  //         unread: 0,
  //         created_at: conv.created_at,
  //         updated_at: conv.updated_at,
  //       };
  //     });

  //     return {
  //       data: enrichedData,
  //       success: true,
  //       message: 'success',
  //     };
  //   } catch (err) {
  //     console.error(err);
  //     throw new HttpException(
  //       'Failed to get conversations',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  /**
   * Start a new conversation with a peer
   */
  async startConversationWithPeer(user: any, peerId: number) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // ✅ Convert to number explicitly
      const userId = Number(userFound.id);
      const peerIdNum = Number(peerId);

      console.log('🔍 User ID:', userId, typeof userId);
      console.log('🔍 Peer ID:', peerIdNum, typeof peerIdNum);

      if (userId === peerIdNum) {
        throw new BadRequestException(
          "You can't start a conversation with yourself.",
        );
      }

      // ✅ Verify peer exists
      const peerUser = await this.usersService.getUserAccountById(peerIdNum);
      if (!peerUser) {
        throw new NotFoundException('Peer user not found');
      }

      console.log('🔍 Peer user loaded:', peerUser.id, peerUser.first_name);

      // ✅ Check if a direct conversation exists
      const userConversations = await this.participantRepository
        .createQueryBuilder('cp1')
        .select('cp1.conversationId')
        .where('cp1.userId = :userId', { userId })
        .andWhere('cp1.isActive = true')
        .getMany();

      console.log('🔍 User conversations:', userConversations.length);

      const userConvIds = userConversations.map((p) => p.conversationId);

      if (userConvIds.length > 0) {
        const sharedConversation = await this.participantRepository
          .createQueryBuilder('cp2')
          .select('cp2.conversationId')
          .where('cp2.conversationId IN (:...ids)', { ids: userConvIds })
          .andWhere('cp2.userId = :peerId', { peerId: peerIdNum })
          .andWhere('cp2.isActive = true')
          .getOne();

        if (sharedConversation) {
          const existing = await this.conversationRepository.findOne({
            where: {
              id: sharedConversation.conversationId,
              type: 'direct',
            },
          });

          if (existing) {
            const participants = await this.participantRepository.find({
              where: { conversationId: existing.id },
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
                peer,
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

      console.log('🔍 Creating new conversation...');

      // ✅ Create new conversation
      const conversation = this.conversationRepository.create({
        type: 'direct',
        created_by: userId,
        createdBy: userFound,
      });
      const savedConversation =
        await this.conversationRepository.save(conversation);

      console.log('✅ Conversation saved:', savedConversation.id);

      // ✅ Add participants with explicit type conversion
      const participants = [
        {
          conversationId: savedConversation.id,
          conversation: savedConversation,
          userId: userId,
          user: userFound,
          role: 'member' as const,
          isActive: true,
          joinedAt: new Date(),
        },
        {
          conversationId: savedConversation.id,
          conversation: savedConversation,
          userId: peerIdNum,
          user: peerUser,
          role: 'member' as const,
          isActive: true,
          joinedAt: new Date(),
        },
      ];

      await this.participantRepository
        .createQueryBuilder()
        .insert()
        .into(ConversationParticipant)
        .values(participants)
        .execute();

      console.log('✅ Participants inserted');

      // ✅ Manual approach - construct response with fetched users
      return {
        data: {
          id: savedConversation.id,
          type: savedConversation.type,
          name:
            peerUser?.fullName ||
            `${peerUser?.first_name || ''} ${
              peerUser?.last_name || ''
            }`.trim() ||
            peerUser?.username ||
            'Unknown User',
          avatar: peerUser?.avatar || '',
          online: peerUser?.logged_in || false,
          peer: {
            id: peerUser.id,
            first_name: peerUser.first_name,
            last_name: peerUser.last_name,
            username: peerUser.username,
            email: peerUser.email,
            avatar: peerUser.avatar,
            logged_in: peerUser.logged_in,
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
      console.error('❌ Error in startConversationWithPeer:', err);
      throw new HttpException(
        'Failed to start conversation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(user: any, conversationId: string) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound)
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      const userId = userFound.id;

      const participant = await this.participantRepository.findOne({
        where: { conversationId, userId: userFound.id, isActive: true },
        relations: ['conversation'],
      });

      if (!participant) {
        throw new BadRequestException(
          'You are not an active member of this conversation.',
        );
      }

      const rawMessages = await this.messageRepository.find({
        where: { conversationId },
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
            status: 'read', // or compute from read receipts
          },
          { excludeExtraneousValues: true }, // 👈 critical
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
   * Get peers who don't have a conversation with the user yet
   */
  async getUnchattedPeers(user: any) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Get all peers the user is connected with
      const peers = await this.peerRepository.find({
        where: {
          user: { id: userFound.id },
          status: UserPeerStatus.CONNECTED,
        },
        relations: ['peer'],
      });

      const peerIds = peers.map((p) => p.peer.id);

      if (!peerIds.length) {
        return { data: [], success: true, message: 'No connected peers' };
      }

      // ✅ Get all peer IDs from conversations (FIXED)
      const chattedParticipants = await this.participantRepository
        .createQueryBuilder('participant')
        .select('participant.userId')
        .where((qb) => {
          const subQuery = qb
            .subQuery()
            .select('cp.conversationId')
            .from(ConversationParticipant, 'cp')
            .where('cp.userId = :userId', { userId: userFound.id })
            .getQuery();
          return 'participant.conversationId IN ' + subQuery;
        })
        .andWhere('participant.userId != :userId', { userId: userFound.id })
        .getRawMany();

      const chattedIds = new Set(
        chattedParticipants.map((p) => p.participant_userId),
      );

      // Filter peers who haven't been chatted with yet
      const unchattedPeers = peers
        .map((p) => ({
          id: p.peer.id,
          name: p.peer.fullName,
          avatar: p.peer.avatar,
          email: p.peer.email,
          online: p.peer.logged_in,
          role: 'Peer', // You can add role logic here
        }))
        .filter((peer) => !chattedIds.has(peer.id));

      return {
        data: unchattedPeers,
        success: true,
        message: 'success',
      };
    } catch (err) {
      console.error(err);
      throw new HttpException(
        'Failed to get unchatted peers',
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
  ): Promise<{ data: MessageResponseDto; success: boolean; message: string }> {
    try {
      // ------------------------------------------------------------
      // 1. Resolve the sender
      // ------------------------------------------------------------
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }
      const senderId = userFound.id.toString();
      // ------------------------------------------------------------
      // 2. Verify active membership (no extra relations needed)
      // ------------------------------------------------------------
      const participant = await this.participantRepository.findOne({
        where: {
          conversationId,
          userId: Number(userFound.id),
          isActive: true,
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

      // ------------------------------------------------------------
      // 3. Create & persist the message
      // ------------------------------------------------------------
      const message = this.messageRepository.create({
        senderId: Number(userFound.id),
        sender: userFound,
        conversationId,
        conversation: conversation,
        content,
        messageType: 'text',
      });

      const savedMessage = await this.messageRepository.save(message);

      // ------------------------------------------------------------
      // 4. Update conversation timestamps
      // ------------------------------------------------------------
      await this.conversationRepository.update(conversationId, {
        lastMessageAt: new Date(),
        // updated_at is handled automatically by @UpdateDateColumn
      });

      // ------------------------------------------------------------
      // 5. Transform to safe DTO (no password, email, etc.)
      // ------------------------------------------------------------
      const dto = plainToInstance(
        MessageResponseDto,
        {
          ...savedMessage,
          sender: userFound, // safe fields only (UserChatDto will filter)
          isMine: true, // the message we just sent
          time: this.formatTime(savedMessage.created_at),
          status: 'sent' as const, // you can upgrade later with read‑receipts
        },
        { excludeExtraneousValues: true }, // <-- strips everything not @Expose()
      );

      // ------------------------------------------------------------
      // 6. Return
      // ------------------------------------------------------------
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
}
