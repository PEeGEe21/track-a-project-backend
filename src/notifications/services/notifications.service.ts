import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { Notification } from 'src/typeorm/entities/Notification';
import { UserNotificationPreference } from 'src/typeorm/entities/UserNotificationPreference';
import { NOTIFICATION_DEFAULT_PREFERENCES } from 'src/utils/constants/notifications';
import { NotificationsGateway } from '../notifications.gateway';
import { UsersService } from 'src/users/services/users.service';
import { TenantQueryHelper } from 'src/common/helpers/tenant-query.helper';
import { Organization } from 'src/typeorm/entities/Organization';
import { Queue, Worker } from 'bullmq';
import { RedisService } from 'src/redis/redis.service';
import { config } from 'src/config';
import { AppLogger } from 'src/common/logging/app-logger';

interface NotificationJobPayload {
  organizationId: string;
  recipientId: number;
  senderId?: number | null;
  title: string;
  message?: string;
  type: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<NotificationJobPayload> | null = null;
  private worker: Worker<NotificationJobPayload> | null = null;

  constructor(
    @Inject(forwardRef(() => UsersService)) private usersService: UsersService,
    private notificationsGateway: NotificationsGateway,
    private redisService: RedisService,

    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(UserNotificationPreference)
    private notificationPrefRepo: Repository<UserNotificationPreference>,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
  ) {}

  async onModuleInit() {
    if (config.queue.driver !== 'redis') {
      return;
    }

    const connection = this.redisService.getBullConnection();
    if (!connection) {
      AppLogger.warn(
        'NotificationsService',
        'QUEUE_DRIVER=redis is configured but Redis is unavailable. Falling back to inline notification delivery.',
      );
      return;
    }

    this.queue = new Queue<NotificationJobPayload>('notifications', {
      connection,
      prefix: config.redis.prefix,
    });
    this.worker = new Worker<NotificationJobPayload>(
      'notifications',
      async (job) => this.createNotificationDirect(job.data),
      {
        connection,
        prefix: config.redis.prefix,
      },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async findAll(user: any, organizationId: string) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const notifications = await this.notificationsRepository.find({
        where: {
          recipient: { id: userFound.id },
          organization_id: organizationId,
        },
        order: { created_at: 'DESC' },
        // take: 20,
      });

      return {
        data: notifications,
        success: true,
        message: 'Success',
      };
    } catch (error) {
      AppLogger.error(
        'NotificationsService',
        'Error fetching user notifications',
      );
      throw new HttpException(
        'Error fetching user notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAllUserNotifications(
    user: any,
    organizationId: string,
    page = 1,
    limit = 10,
    search?: string,
    type?: string,
    status?: string,
  ) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const queryBuilder = TenantQueryHelper.createOrganizationQuery(
        this.notificationsRepository,
        organizationId,
        'notifications',
      )

        // const queryBuilder = this.notificationsRepository
        //   .createQueryBuilder('notifications')
        .leftJoinAndSelect('notifications.recipient', 'recipient')
        .leftJoinAndSelect('notifications.sender', 'sender')
        .where('recipient.id = :id', { id: userFound.id })
        .andWhere('notifications.organization_id = :organizationId', {
          organizationId,
        });

      if (search) {
        const lowered = `%${search.toLowerCase()}%`;
        queryBuilder.andWhere(
          `(
              LOWER(sender.first_name) LIKE :search OR
              LOWER(sender.last_name) LIKE :search OR
              LOWER(sender.email) LIKE :search OR
              LOWER(notifications.title) LIKE :search OR
              LOWER(notifications.message) LIKE :search
            )`,
          { search: lowered },
        );
      }

      if (type && type !== 'all') {
        const loweredType = type.toLowerCase();
        queryBuilder.andWhere(`LOWER(notifications.type) = :type`, {
          type: loweredType,
        });
      }

      if (status && status !== 'all') {
        const newStatus = status === 'read';
        queryBuilder.andWhere(`notifications.is_read = :status`, {
          status: newStatus,
        });
      }

      queryBuilder.orderBy('notifications.created_at', 'DESC');
      queryBuilder.skip((page - 1) * limit).take(limit);

      const [result, total] = await queryBuilder.getManyAndCount();
      const lastPage = Math.ceil(total / limit);

      return {
        data: result,
        meta: {
          current_page: Number(page),
          from: (page - 1) * limit + 1,
          last_page: lastPage,
          per_page: Number(limit),
          to: (page - 1) * limit + result.length,
          total: total,
        },
        success: true,
      };
    } catch (error) {
      AppLogger.error(
        'NotificationsService',
        'Error fetching user notifications',
      );
      throw new HttpException(
        'Error fetching user notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(user: any, id: number) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const notification = await this.notificationsRepository.findOne({
        where: { id },
      });

      if (!notification) {
        throw new NotFoundException(`Notification with ID ${id} not found`);
      }

      return {
        data: notification,
        success: true,
        message: 'Success',
      };
    } catch (error) {
      AppLogger.error(
        'NotificationsService',
        'Error fetching user notifications',
      );
      throw new HttpException(
        'Error fetching user notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createNotification(
    user: any,
    createNotificationDto: CreateNotificationDto,
    organizationId: string,
  ) {
    try {
      const payload = this.toJobPayload(createNotificationDto, organizationId);

      if (config.queue.driver === 'redis' && this.queue) {
        await this.queue.add('deliver-notification', payload, {
          attempts: 3,
          removeOnComplete: 100,
          removeOnFail: 100,
        });

        return {
          success: true,
          queued: true,
          message: 'Notification queued successfully',
        };
      }

      const savedNotification = await this.createNotificationDirect(payload);
      return {
        data: savedNotification,
        success: true,
        queued: false,
        message: 'Notification created successfully',
      };
    } catch (error) {
      AppLogger.error(
        'NotificationsService',
        'Error creating user notification',
      );
      throw new HttpException(
        'Error creating user notification',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async markAsRead(user: any, id: number) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const notification = await this.notificationsRepository.findOne({
        where: { id },
      });
      notification.is_read = true;

      await this.notificationsRepository.save(notification);

      return {
        data: notification,
        success: true,
        message: 'Success',
      };
    } catch (error) {
      AppLogger.error(
        'NotificationsService',
        'Error marking user notifications',
      );
      throw new HttpException(
        'Error marking user notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async markAllAsRead(user: any, organizationId: string) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      await this.notificationsRepository.update(
        {
          recipient: { id: userFound.id },
          organization_id: organizationId,
          is_read: false,
        },
        { is_read: true },
      );

      return {
        message: 'Success',
        success: true,
      };
    } catch (error) {
      AppLogger.error(
        'NotificationsService',
        'Error marking user notifications',
      );
      throw new HttpException(
        'Error marking user notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(user: any, id: number) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }
      const notification = await this.notificationsRepository.findOne({
        where: { id },
      });

      await this.notificationsRepository.remove(notification);

      return {
        message: 'Success',
        success: true,
      };
    } catch (error) {
      AppLogger.error(
        'NotificationsService',
        'Error deleting user notification',
      );
      throw new HttpException(
        'Error marking user notifications',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private toJobPayload(
    createNotificationDto: CreateNotificationDto,
    organizationId: string,
  ): NotificationJobPayload {
    return {
      organizationId,
      recipientId: createNotificationDto.recipient.id,
      senderId: createNotificationDto.sender?.id ?? null,
      title: createNotificationDto.title,
      message: createNotificationDto.message,
      type: createNotificationDto.type,
      metadata: createNotificationDto.metadata,
    };
  }

  private async createNotificationDirect(payload: NotificationJobPayload) {
    const organization = await this.orgRepository.findOne({
      where: { id: payload.organizationId },
    });

    const notification = this.notificationsRepository.create({
      recipient: { id: payload.recipientId } as any,
      sender: payload.senderId ? ({ id: payload.senderId } as any) : null,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      metadata: payload.metadata,
      is_read: false,
      created_at: new Date(),
      organization_id: payload.organizationId,
      organization,
    });

    const savedNotification = await this.notificationsRepository.save(
      notification,
    );

    this.notificationsGateway.sendNotificationToUser(
      String(payload.recipientId),
      savedNotification,
    );

    return savedNotification;
  }

  //   async createNotification(dto: CreateNotificationDto) {
  //     const notification = this.notificationRepo.create({
  //       ...dto,
  //       recipient: { id: dto.recipientId },
  //       sender: dto.senderId ? { id: dto.senderId } : null,
  //     });
  //     return this.notificationRepo.save(notification);
  //   }

  //   createNotification2(userId: string, content: string, type: string) {
  //     const notification = {
  //       id: Math.random().toString(36).substring(7),
  //       userId,
  //       content,
  //       type,
  //       createdAt: new Date(),
  //       read: false,
  //     };
  //     // Save to database here...

  //     // const notification = this.notificationRepo.create({
  //     //     ...dto,
  //     //     recipient: { id: dto.recipientId },
  //     //     sender: dto.senderId ? { id: dto.senderId } : null,
  //     //   });

  //     // Save to database here...

  //     // Send via WebSocket
  //     this.notificationsGateway.sendNotificationToUser(userId, notification);

  //     return notification;
  //   }

  //   async getUserNotifications(userId: number) {
  //     return this.notificationRepo.find({
  //       where: { recipient: { id: userId } },
  //       order: { created_at: 'DESC' },
  //     });
  //   }

  //   async markAsRead(notificationId: number) {
  //     await this.notificationRepo.update(notificationId, { is_read: true });
  //     return this.notificationRepo.findOne({ where: { id: notificationId } });
  //   }

  //   async deleteNotification(notificationId: number) {
  //     return this.notificationRepo.delete(notificationId);
  //   }

  //   async sendNotification(dto: CreateNotificationDto) {
  //     const prefs = await this.notificationPrefRepo.findOne({
  //       where: { user: { id: dto.recipientId }, notification_type: dto.type },
  //     });

  //     const effectivePrefs = prefs ?? NOTIFICATION_DEFAULT_PREFERENCES[dto.type];

  //     // Always save in DB if in_app enabled
  //     if (effectivePrefs.in_app) {
  //       const notification = this.notificationRepo.create({
  //         ...dto,
  //         recipient: { id: dto.recipientId },
  //         sender: dto.senderId ? { id: dto.senderId } : null,
  //       });
  //       await this.notificationRepo.save(notification);
  //     }

  //     // If email enabled, trigger email service
  //     // if (effectivePrefs.email) {
  //     //   await this.emailService.sendNotificationEmail(
  //     //     dto.recipientId,
  //     //     dto.title,
  //     //     dto.message,
  //     //   );
  //     // }

  //     // If push enabled, trigger push service (optional)
  //     // if (effectivePrefs.push) {
  //     //   await this.pushService.sendPushNotification(
  //     //     dto.recipientId,
  //     //     dto.title,
  //     //     dto.message,
  //     //   );
  //     // }
  //   }
}
