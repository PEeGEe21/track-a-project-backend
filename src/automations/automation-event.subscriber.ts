import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AutomationEventActorType } from 'src/typeorm/entities/AutomationEvent';
import { Task } from 'src/typeorm/entities/Task';
import { TaskCustomFieldValue } from 'src/typeorm/entities/TaskCustomFieldValue';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { AutomationEventsService } from './automation-events.service';
import { AutomationExecutionContextService } from './automation-execution-context.service';
import { AutomationRequestContextService } from './automation-request-context.service';
import { TaskWatcher } from 'src/typeorm/entities/TaskWatcher';
import { Notification } from 'src/typeorm/entities/Notification';
import { User } from 'src/typeorm/entities/User';
import { NotificationsService } from 'src/notifications/services/notifications.service';

@Injectable()
export class AutomationEventSubscriber
  implements EntitySubscriberInterface, OnModuleDestroy
{
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: AutomationEventsService,
    private readonly executionContext: AutomationExecutionContextService,
    private readonly requestContext: AutomationRequestContextService,
    private readonly notifications: NotificationsService,
  ) {
    if (!dataSource.subscribers.includes(this))
      dataSource.subscribers.push(this);
  }

  onModuleDestroy() {
    const index = this.dataSource.subscribers.indexOf(this);
    if (index >= 0) this.dataSource.subscribers.splice(index, 1);
  }

  async afterInsert(event: InsertEvent<any>) {
    if (event.metadata.target === Task)
      await this.captureTaskCreated(event, event.entity as Task);
    if (event.metadata.target === TaskCustomFieldValue)
      await this.captureCustomFieldChange(
        event,
        event.entity as TaskCustomFieldValue,
        null,
      );
  }

  async afterUpdate(event: UpdateEvent<any>) {
    if (event.metadata.target === Task) await this.captureTaskUpdate(event);
    if (event.metadata.target === TaskCustomFieldValue) {
      const value = (event.entity ??
        event.databaseEntity) as TaskCustomFieldValue;
      await this.captureCustomFieldChange(
        event,
        value,
        event.databaseEntity?.value ?? null,
      );
    }
  }

  async afterRemove(event: RemoveEvent<any>) {
    if (event.metadata.target !== TaskCustomFieldValue) return;
    const value = (event.databaseEntity ??
      event.entity) as TaskCustomFieldValue;
    if (value)
      await this.captureCustomFieldChange(
        event,
        value,
        value.value ?? null,
        true,
      );
  }

  private async captureTaskCreated(event: InsertEvent<any>, task: Task) {
    if (!task?.id) return;
    if (!task.organization_id || !task.project?.id) return;
    const snapshot = await this.events.taskSnapshot(event.manager, task.id);
    if (!snapshot) return;
    const eventId = await this.events.capture(event.manager, {
      organizationId: String(task.organization_id),
      projectId: Number(task.project?.id),
      eventType: 'task.created',
      subjectType: 'task',
      subjectId: task.id,
      dedupeKey: `task-created:${task.id}`,
      after: snapshot,
      ...this.attribution(task.user?.id),
    });
  }

  private async captureTaskUpdate(event: UpdateEvent<any>) {
    const taskId = Number(event.entity?.id ?? event.databaseEntity?.id);
    if (!taskId) return;
    const changed = new Set([
      ...event.updatedColumns.map((column) => column.propertyName),
      ...event.updatedRelations.map((relation) => relation.propertyName),
      ...Object.keys(event.entity ?? {}).filter((key) =>
        [
          'title',
          'description',
          'description_html',
          'priority',
          'severity',
          'due_date',
          'status',
        ].includes(key),
      ),
    ]);
    const interesting = [...changed].filter((key) =>
      [
        'title',
        'description',
        'description_html',
        'priority',
        'severity',
        'due_date',
        'status',
      ].includes(key),
    );
    if (!interesting.length) return;
    const snapshot = await this.events.taskSnapshot(event.manager, taskId);
    if (!snapshot) return;
    const task = await event.manager.getRepository(Task).findOne({
      where: { id: taskId },
      relations: ['project', 'status'],
    });
    if (!task?.organization_id || !task.project?.id) return;
    const before = event.databaseEntity
      ? { task: this.rawTaskSnapshot(event.databaseEntity) }
      : null;
    const context = {
      organizationId: task.organization_id,
      projectId: task.project.id,
      subjectType: 'task',
      subjectId: taskId,
      before,
      after: { ...snapshot, changedFields: interesting },
      ...this.attribution(),
    };
    const eventId = await this.events.capture(event.manager, {
      ...context,
      eventType: 'task.field_changed',
    });
    await this.notifyWatchers(
      event.manager,
      task,
      eventId,
      interesting.includes('status') ? 'status changed' : 'was updated',
    );
    if (interesting.includes('status'))
      await this.events.capture(event.manager, {
        ...context,
        eventType: 'task.status_changed',
      });
  }

  private async captureCustomFieldChange(
    event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any>,
    value: TaskCustomFieldValue,
    previous: unknown,
    removed = false,
  ) {
    const taskId = Number(value?.task_id ?? value?.task?.id);
    const definitionId = value?.definition_id ?? value?.definition?.id;
    if (!taskId || !definitionId) return;
    const snapshot = await this.events.taskSnapshot(event.manager, taskId);
    if (!snapshot) return;
    const task = await event.manager.getRepository(Task).findOne({
      where: { id: taskId },
      relations: ['project'],
    });
    if (!task?.organization_id || !task.project?.id) return;
    const eventId = await this.events.capture(event.manager, {
      organizationId: task.organization_id,
      projectId: task.project.id,
      eventType: 'task.field_changed',
      subjectType: 'task',
      subjectId: taskId,
      before: {
        field: `custom:${definitionId}`,
        value: previous,
      },
      after: {
        ...snapshot,
        changedFields: [`custom:${definitionId}`],
        changedValue: removed ? null : value.value,
      },
      ...this.attribution(),
    });
    await this.notifyWatchers(
      event.manager,
      task,
      eventId,
      'custom fields changed',
    );
  }

  private actor(userId?: number | null) {
    return userId
      ? { actorType: 'human' as const, actorId: userId }
      : { actorType: 'system' as const, actorId: null };
  }

  private async notifyWatchers(
    manager: any,
    task: Task,
    eventId: string | null,
    change: string,
  ) {
    if (!eventId) return;
    const actorId = this.requestContext.currentUserId();
    const watchers = await manager.getRepository(TaskWatcher).find({
      where: { task_id: task.id, organization_id: task.organization_id },
    });
    const recipients = watchers.filter(
      (watcher: TaskWatcher) => Number(watcher.user_id) !== Number(actorId),
    );
    if (!recipients.length) return;
    const saved = await manager.getRepository(Notification).save(
      recipients.map((watcher: TaskWatcher) => ({
        recipient: { id: watcher.user_id } as User,
        sender: actorId ? ({ id: actorId } as User) : null,
        title: 'Task watcher update',
        message: `${task.title || `Task ${task.id}`} ${change}.`,
        type: 'task_watcher',
        organization_id: task.organization_id,
        created_at: new Date(),
        metadata: {
          projectId: task.project.id,
          taskId: task.id,
          deliveryKey: `watcher:${eventId}:${watcher.user_id}`,
        },
      })),
    );
    setTimeout(() => {
      for (const notification of saved)
        void this.notifications.deliverCommittedNotification(notification);
    }, 0);
  }

  private attribution(userId?: number | null) {
    const context = this.executionContext.current();
    if (!context)
      return this.actor(userId ?? this.requestContext.currentUserId());
    return {
      actorType: 'automation' as const,
      actorId: context.actorId,
      causationEventId: context.causationEventId,
      correlationId: context.correlationId,
      ancestorRuleIds: context.ancestorRuleIds,
      chainDepth: context.chainDepth,
      actionCount: context.actionCount,
    };
  }

  private rawTaskSnapshot(task: any) {
    return {
      id: task.id,
      title: task.title,
      priority: task.priority,
      severity: task.severity,
      dueDate: task.due_date ?? null,
      statusId: task.status?.id ?? task.status_id ?? null,
    };
  }
}
