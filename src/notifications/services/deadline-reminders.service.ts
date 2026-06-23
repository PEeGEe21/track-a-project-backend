import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { addDays } from 'date-fns';
import { Organization } from 'src/typeorm/entities/Organization';
import { Task } from 'src/typeorm/entities/Task';
import { TaskDeadlineReminder } from 'src/typeorm/entities/TaskDeadlineReminder';
import { User } from 'src/typeorm/entities/User';
import { NOTIFICATION_TYPES } from 'src/utils/constants/notifications';
import { QueryFailedError, Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { AppLogger } from 'src/common/logging/app-logger';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { OrganizationSettings } from 'src/typeorm/entities/OrganizationSettings';

type ReminderRunOptions = {
  ignoreTimeWindow?: boolean;
};

type ReminderRunSummary = {
  settingsFound: boolean;
  remindersEnabled: boolean;
  daysBefore: number;
  reminderHour: number;
  reminderMinute: number;
  matchedTaskCount: number;
  taskWithoutRecipientCount: number;
  recipientCount: number;
  existingReminderCount: number;
  queuedCount: number;
  suppressedCount: number;
  inAppCount: number;
  pushAttemptCount: number;
  pushDeliveredCount: number;
  emailSentCount: number;
  pushErrors: Array<{
    endpointHash: string;
    statusCode?: number;
    message: string;
  }>;
};

@Injectable()
export class DeadlineRemindersService {
  private readonly reminderTimeZone = 'Africa/Lagos';
  private lastMissingSchemaWarningAt: number | null = null;

  constructor(
    @InjectRepository(OrganizationSettings)
    private readonly organizationSettingsRepository: Repository<OrganizationSettings>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(TaskDeadlineReminder)
    private readonly reminderRepository: Repository<TaskDeadlineReminder>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scanUpcomingDeadlines() {
    let settingsRows: OrganizationSettings[] = [];
    try {
      settingsRows = await this.organizationSettingsRepository.find({
        where: {
          deadline_reminders_enabled: true,
        },
        relations: ['organization'],
      });
    } catch (error) {
      if (this.isMissingReminderSchemaError(error)) {
        this.logMissingSchemaWarning();
        return;
      }
      throw error;
    }

    for (const settings of settingsRows) {
      if (!settings.organization) {
        continue;
      }
      try {
        await this.processOrganization(settings.organization, settings);
      } catch (error) {
        AppLogger.error(
          'DeadlineRemindersService',
          'Failed processing organization deadline reminders',
          {
            organizationId: settings.organization.id,
            message: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }
  }

  async runManualTestForOrganization(organizationId: string) {
    const settings = await this.organizationSettingsRepository.findOne({
      where: { organization_id: organizationId },
      relations: ['organization'],
    });

    if (!settings?.organization) {
      return {
        success: false,
        message:
          'Organization reminder settings were not found. Save workspace settings first and rerun the test.',
        data: {
          settingsFound: false,
          remindersEnabled: false,
          daysBefore: 0,
          reminderHour: 0,
          reminderMinute: 0,
          matchedTaskCount: 0,
          taskWithoutRecipientCount: 0,
          recipientCount: 0,
          existingReminderCount: 0,
          queuedCount: 0,
          suppressedCount: 0,
          inAppCount: 0,
          pushAttemptCount: 0,
          pushDeliveredCount: 0,
          emailSentCount: 0,
          pushErrors: [],
        } satisfies ReminderRunSummary,
      };
    }

    const summary = await this.processOrganization(
      settings.organization,
      settings,
      {
        ignoreTimeWindow: true,
      },
    );

    const totalDispositions =
      summary.queuedCount +
      summary.suppressedCount +
      summary.existingReminderCount;
    const message =
      summary.matchedTaskCount === 0
        ? 'No eligible tasks matched the current reminder window.'
        : totalDispositions === 0
          ? 'Eligible tasks were found, but no reminder could be delivered.'
          : 'Deadline reminder test completed.';

    return {
      success: true,
      message,
      data: summary,
    };
  }

  private async processOrganization(
    organization: Organization,
    settings: OrganizationSettings,
    options: ReminderRunOptions = {},
  ) {
    const daysBefore = Math.max(
      1,
      Number(settings.deadline_reminder_days_before || 0),
    );
    const reminderHour = Math.min(
      23,
      Math.max(0, Number(settings.deadline_reminder_hour ?? 9)),
    );
    const reminderMinute = Math.min(
      59,
      Math.max(0, Number(settings.deadline_reminder_minute ?? 0)),
    );
    const summary: ReminderRunSummary = {
      settingsFound: true,
      remindersEnabled: Boolean(settings.deadline_reminders_enabled),
      daysBefore,
      reminderHour,
      reminderMinute,
      matchedTaskCount: 0,
      taskWithoutRecipientCount: 0,
      recipientCount: 0,
      existingReminderCount: 0,
      queuedCount: 0,
      suppressedCount: 0,
      inAppCount: 0,
      pushAttemptCount: 0,
      pushDeliveredCount: 0,
      emailSentCount: 0,
      pushErrors: [],
    };

    if (
      !options.ignoreTimeWindow &&
      !this.isWithinReminderTimeWindow(reminderHour, reminderMinute)
    ) {
      return summary;
    }

    const now = new Date();
    const cutoff = addDays(now, daysBefore);

    const tasks = await this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.status', 'status')
      .leftJoinAndSelect('task.assignees', 'assignees')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('project.user', 'projectOwner')
      .where('task.organization_id = :organizationId', {
        organizationId: organization.id,
      })
      .andWhere('task.due_date IS NOT NULL')
      .andWhere('task.due_date > :now', { now })
      .andWhere('task.due_date <= :cutoff', { cutoff })
      .andWhere('(status.id IS NULL OR status.isTerminal = :isTerminal)', {
        isTerminal: false,
      })
      .getMany();
    summary.matchedTaskCount = tasks.length;

    for (const task of tasks) {
      const recipients = this.resolveRecipients(task);
      if (recipients.length === 0) {
        summary.taskWithoutRecipientCount += 1;
        continue;
      }

      summary.recipientCount += recipients.length;
      for (const recipient of recipients) {
        const reminderKey = this.buildReminderKey(
          task,
          recipient.id,
          daysBefore,
        );
        const existingReminder = await this.reminderRepository.findOne({
          where: { reminder_key: reminderKey },
        });

        if (existingReminder) {
          summary.existingReminderCount += 1;
          continue;
        }

        const payload: CreateNotificationDto = {
          recipient,
          sender: null,
          title: `Upcoming deadline: ${task.title}`,
          message: this.buildReminderMessage(task, daysBefore),
          type: NOTIFICATION_TYPES.DEADLINE_REMINDER,
          metadata: {
            path: `/projects/${task.project?.id ?? ''}`,
            taskId: task.id,
            projectId: task.project?.id ?? null,
            projectTitle: task.project?.title ?? null,
            dueDate: task.due_date?.toISOString() ?? null,
            daysBefore,
            deliveryKey: reminderKey,
          },
        };

        const result = options.ignoreTimeWindow
          ? await this.notificationsService.deliverNotificationNow(
              payload,
              organization.id,
            )
          : await this.notificationsService.enqueueNotification(
              payload,
              organization.id,
            );

        if (result?.skipped) {
          summary.suppressedCount += 1;
        } else {
          summary.queuedCount += 1;
        }

        if (options.ignoreTimeWindow && result?.data) {
          if (result.data.notification) {
            summary.inAppCount += 1;
          }
          if (result.data.push) {
            summary.pushAttemptCount += result.data.push.subscriptionCount;
            summary.pushDeliveredCount += result.data.push.deliveredCount;
            summary.pushErrors.push(...result.data.push.errors);
          }
          if (result.data.emailed) {
            summary.emailSentCount += 1;
          }
        }

        await this.reminderRepository.save(
          this.reminderRepository.create({
            reminder_key: reminderKey,
            task: { id: task.id } as Task,
            recipient: { id: recipient.id } as User,
            organization_id: organization.id,
            organization,
            days_before: daysBefore,
            due_date: task.due_date as Date,
            delivery_status: result?.skipped ? 'suppressed' : 'queued',
            metadata: {
              taskTitle: task.title,
              projectTitle: task.project?.title ?? null,
            },
          }),
        );
      }
    }

    return summary;
  }

  private resolveRecipients(task: Task): User[] {
    const recipients = task.assignees?.length
      ? task.assignees
      : task.project?.user
        ? [task.project.user]
        : [];

    const uniqueRecipients = new Map<number, User>();
    for (const recipient of recipients) {
      if (recipient?.id) {
        uniqueRecipients.set(recipient.id, recipient);
      }
    }

    return Array.from(uniqueRecipients.values());
  }

  private buildReminderKey(
    task: Task,
    recipientId: number,
    daysBefore: number,
  ) {
    const dueDate = task.due_date?.toISOString() ?? 'no-due-date';
    return `deadline:${task.id}:${recipientId}:${daysBefore}:${dueDate}`;
  }

  private buildReminderMessage(task: Task, daysBefore: number) {
    const dueDate = task.due_date
      ? new Intl.DateTimeFormat('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(task.due_date)
      : 'an upcoming date';

    const projectTitle = task.project?.title ? ` in ${task.project.title}` : '';

    return `"${
      task.title
    }"${projectTitle} is due on ${dueDate}. This reminder was sent ${daysBefore} day${
      daysBefore === 1 ? '' : 's'
    } ahead of the deadline.`;
  }

  private isWithinReminderTimeWindow(hour: number, minute: number) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: this.reminderTimeZone,
    });
    const parts = formatter.formatToParts(now);
    const currentHour = Number(
      parts.find((part) => part.type === 'hour')?.value ?? '0',
    );
    const currentMinute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? '0',
    );

    return currentHour === hour && currentMinute === minute;
  }

  private isMissingReminderSchemaError(error: unknown) {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = (error as QueryFailedError & {
      driverError?: { code?: string; message?: string };
    }).driverError;

    return (
      driverError?.code === 'ER_NO_SUCH_TABLE' &&
      typeof driverError.message === 'string' &&
      (driverError.message.includes('organization_settings') ||
        driverError.message.includes('task_deadline_reminders'))
    );
  }

  private logMissingSchemaWarning() {
    const now = Date.now();
    const warningCooldownMs = 15 * 60 * 1000;

    if (
      this.lastMissingSchemaWarningAt &&
      now - this.lastMissingSchemaWarningAt < warningCooldownMs
    ) {
      return;
    }

    this.lastMissingSchemaWarningAt = now;
    AppLogger.warn(
      'DeadlineRemindersService',
      'Deadline reminder scheduler skipped because reminder tables are missing. Run the latest migrations to enable deadline reminders.',
    );
  }
}
