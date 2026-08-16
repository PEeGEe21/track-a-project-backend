import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { AutomationEventActorType } from 'src/typeorm/entities/AutomationEvent';
import { Task } from 'src/typeorm/entities/Task';
import { TaskCustomFieldValue } from 'src/typeorm/entities/TaskCustomFieldValue';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppLogger } from 'src/common/logging/app-logger';

export type CaptureAutomationEventInput = {
  organizationId: string;
  projectId: number;
  eventType: string;
  subjectType: string;
  subjectId: string | number;
  dedupeKey?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  actorType?: AutomationEventActorType;
  actorId?: string | number | null;
  correlationId?: string;
  causationEventId?: string | null;
  ancestorRuleIds?: string[];
  chainDepth?: number;
  actionCount?: number;
  occurredAt?: Date;
  availableAt?: Date;
};

@Injectable()
export class AutomationEventsService {
  private deadlineScanRunning = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly entitlements: EntitlementsService,
  ) {}

  async capture(
    manager: EntityManager,
    input: CaptureAutomationEventInput,
  ): Promise<string | null> {
    if (
      !input.organizationId ||
      !Number.isInteger(input.projectId) ||
      input.projectId < 1
    )
      return null;
    const enabled = (
      await this.entitlements.resolveOrganization(input.organizationId)
    ).find((item) => item.key === CapabilityKey.RULE_BASED_AUTOMATION)?.enabled;
    if (!enabled) return null;

    const id = randomUUID();
    await manager
      .createQueryBuilder()
      .insert()
      .into('automation_events')
      .values({
        id,
        organization_id: input.organizationId,
        project_id: input.projectId,
        event_type: input.eventType,
        subject_type: input.subjectType,
        subject_id: String(input.subjectId),
        dedupe_key: input.dedupeKey ?? null,
        before_snapshot: this.sanitize(input.before),
        after_snapshot: this.sanitize(input.after),
        actor_type: input.actorType ?? 'system',
        actor_id:
          input.actorId === undefined || input.actorId === null
            ? null
            : String(input.actorId),
        correlation_id: input.correlationId ?? randomUUID(),
        causation_event_id: input.causationEventId ?? null,
        ancestor_rule_ids: input.ancestorRuleIds ?? null,
        chain_depth: input.chainDepth ?? 0,
        action_count: input.actionCount ?? 0,
        occurred_at: input.occurredAt ?? new Date(),
        available_at: input.availableAt ?? new Date(),
      })
      .orIgnore()
      .execute();
    return id;
  }

  async taskSnapshot(manager: EntityManager, taskId: number) {
    const task = await manager.getRepository(Task).findOne({
      where: { id: taskId },
      relations: ['project', 'status', 'assignees'],
    });
    if (!task) return null;
    const values = await manager.getRepository(TaskCustomFieldValue).find({
      where: { task_id: taskId },
      take: 50,
    });
    return {
      task: {
        id: task.id,
        title: task.title,
        priority: task.priority,
        severity: task.severity,
        dueDate: task.due_date?.toISOString() ?? null,
        statusId: task.status?.id ?? null,
        assigneeIds: (task.assignees ?? []).map((user) => Number(user.id)),
      },
      customFields: Object.fromEntries(
        values.map((value) => [value.definition_id, value.value]),
      ),
    };
  }

  @Cron('*/1 * * * *')
  async captureReachedDeadlines() {
    if (this.deadlineScanRunning) return;
    this.deadlineScanRunning = true;
    try {
      const candidates: Array<{
        id: number;
        organization_id: string;
        project_id: number;
        due_date: Date;
      }> = await this.dataSource.query(
        `SELECT DISTINCT t.id, t.organization_id, t.project_id, t.due_date
         FROM tasks t
         INNER JOIN automation_rules r
           ON r.project_id = t.project_id
          AND r.organization_id = t.organization_id
          AND r.active = 1
          AND r.archived_at IS NULL
         INNER JOIN automation_rule_versions v
           ON v.id = r.published_version_id
          AND v.state = 'published'
         LEFT JOIN status s ON s.id = t.status_id
         WHERE JSON_UNQUOTE(JSON_EXTRACT(v.definition, '$.trigger.type')) = 'task.deadline_reached'
           AND t.due_date IS NOT NULL
           AND t.due_date <= UTC_TIMESTAMP(6)
           AND t.due_date >= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 DAY)
           AND (s.id IS NULL OR s.isTerminal = 0)
         ORDER BY t.due_date ASC, t.id ASC
         LIMIT 500`,
      );
      for (const candidate of candidates) {
        const due = new Date(candidate.due_date);
        const snapshot = await this.taskSnapshot(
          this.dataSource.manager,
          candidate.id,
        );
        await this.capture(this.dataSource.manager, {
          organizationId: candidate.organization_id,
          projectId: Number(candidate.project_id),
          eventType: 'task.deadline_reached',
          subjectType: 'task',
          subjectId: candidate.id,
          dedupeKey: `deadline:${candidate.id}:${due.toISOString()}`,
          after: snapshot,
          actorType: 'system',
          occurredAt: due,
        });
      }
    } catch {
      AppLogger.error(
        'AutomationEventsService',
        'Automation deadline event scan failed',
      );
    } finally {
      this.deadlineScanRunning = false;
    }
  }

  private sanitize(value: unknown, depth = 0): any {
    if (value === undefined || value === null) return null;
    if (depth > 5) return '[bounded]';
    if (typeof value === 'string') return value.slice(0, 1000);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value))
      return value.slice(0, 50).map((item) => this.sanitize(item, depth + 1));
    if (typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .slice(0, 100)
          .map(([key, item]) => [
            key.slice(0, 100),
            this.sanitize(item, depth + 1),
          ]),
      );
    return String(value).slice(0, 1000);
  }
}
