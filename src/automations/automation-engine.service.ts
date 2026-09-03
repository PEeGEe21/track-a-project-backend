import { BadRequestException, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { CustomFieldsService } from 'src/custom-fields/custom-fields.service';
import { AutomationActionAttempt } from 'src/typeorm/entities/AutomationActionAttempt';
import { AutomationEvent } from 'src/typeorm/entities/AutomationEvent';
import { AutomationRule } from 'src/typeorm/entities/AutomationRule';
import { AutomationRun } from 'src/typeorm/entities/AutomationRun';
import { Notification } from 'src/typeorm/entities/Notification';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectWorkflowTransition } from 'src/typeorm/entities/ProjectWorkflowTransition';
import {
  ReusableTemplate,
  ReusableTemplateType,
} from 'src/typeorm/entities/ReusableTemplate';
import { Status } from 'src/typeorm/entities/Status';
import { Task } from 'src/typeorm/entities/Task';
import { TaskWatcher } from 'src/typeorm/entities/TaskWatcher';
import { User } from 'src/typeorm/entities/User';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { DataSource, EntityManager } from 'typeorm';
import { TaskCustomFieldValue } from 'src/typeorm/entities/TaskCustomFieldValue';
import { AppLogger } from 'src/common/logging/app-logger';
import {
  AutomationActionType,
  AutomationConditionOperator,
  AutomationTriggerType,
} from './automation-contract';
import { AutomationEventsService } from './automation-events.service';
import { AutomationExecutionContextService } from './automation-execution-context.service';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { ProjectsGateway } from 'src/projects/projects.gateway';
import { AuditWriterService } from 'src/audit/audit-writer.service';
import {
  AuditAction,
  AuditActorType,
  AuditSource,
  AuditSubjectType,
} from 'src/audit/audit-contract';

type Definition = {
  trigger: { type: string; config?: Record<string, unknown> };
  conditions: Array<{
    field: string;
    operator: AutomationConditionOperator;
    value?: unknown;
  }>;
  actions: Array<{
    key: string;
    type: AutomationActionType;
    config: Record<string, any>;
  }>;
};

@Injectable()
export class AutomationEngineService {
  private polling = false;
  static readonly MAX_CHAIN_DEPTH = 10;
  static readonly MAX_CHAIN_ACTIONS = 50;
  static readonly MAX_ATTEMPTS = 3;

  constructor(
    private readonly dataSource: DataSource,
    private readonly entitlements: EntitlementsService,
    private readonly customFields: CustomFieldsService,
    private readonly automationEvents: AutomationEventsService,
    private readonly executionContext: AutomationExecutionContextService,
    private readonly notificationsService: NotificationsService,
    private readonly projectsGateway: ProjectsGateway,
    private readonly auditWriter: AuditWriterService,
  ) {}

  @Cron('*/10 * * * * *')
  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.dataSource.query(
        `UPDATE automation_runs
         SET state = 'failed', failure_code = 'operational:lease_expired'
         WHERE state IN ('evaluating','running')
           AND updated_at < DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 15 MINUTE)`,
      );
      await this.matchEvents();
      const runIds: Array<{ id: string }> = await this.dataSource.query(
        `SELECT id FROM automation_runs
         WHERE state = 'queued'
            OR (state = 'failed' AND attempt_count < ? AND failure_code LIKE 'operational:%')
         ORDER BY created_at ASC LIMIT 50`,
        [AutomationEngineService.MAX_ATTEMPTS],
      );
      for (const row of runIds) await this.executeRun(row.id);
    } catch {
      AppLogger.error(
        'AutomationEngineService',
        'Automation engine poll failed',
      );
    } finally {
      this.polling = false;
    }
  }

  async matchEvents() {
    // QueryBuilder avoids loading already-fully-matched historical events.
    const candidates = await this.dataSource
      .getRepository(AutomationEvent)
      .createQueryBuilder('event')
      .where('event.available_at <= UTC_TIMESTAMP(6)')
      .andWhere(
        `EXISTS (SELECT 1 FROM automation_rules rule_match
          INNER JOIN automation_rule_versions version_match ON version_match.id = rule_match.published_version_id
          WHERE rule_match.project_id = event.project_id
            AND rule_match.organization_id = event.organization_id
            AND rule_match.active = 1 AND rule_match.archived_at IS NULL
            AND rule_match.active_since IS NOT NULL
            AND rule_match.active_since <= event.occurred_at
            AND version_match.published_at <= event.occurred_at
            AND JSON_UNQUOTE(JSON_EXTRACT(version_match.definition, '$.trigger.type')) = event.event_type
            AND NOT EXISTS (SELECT 1 FROM automation_runs existing_run
              WHERE existing_run.rule_id = rule_match.id
                AND existing_run.rule_version_id = version_match.id
                AND existing_run.event_id = event.id))`,
      )
      .orderBy('event.available_at', 'ASC')
      .take(200)
      .getMany();
    for (const event of candidates) {
      const rules = await this.dataSource
        .getRepository(AutomationRule)
        .createQueryBuilder('rule')
        .innerJoinAndSelect('rule.published_version', 'version')
        .where('rule.organization_id = :organizationId', {
          organizationId: event.organization_id,
        })
        .andWhere('rule.project_id = :projectId', {
          projectId: event.project_id,
        })
        .andWhere('rule.active = 1 AND rule.archived_at IS NULL')
        .andWhere(
          'rule.active_since IS NOT NULL AND rule.active_since <= :occurredAt',
          {
            occurredAt: event.occurred_at,
          },
        )
        .andWhere('version.published_at <= :occurredAt', {
          occurredAt: event.occurred_at,
        })
        .andWhere(
          "JSON_UNQUOTE(JSON_EXTRACT(version.definition, '$.trigger.type')) = :type",
          {
            type: event.event_type,
          },
        )
        .getMany();
      for (const rule of rules) {
        const blocked =
          (event.ancestor_rule_ids ?? []).includes(rule.id) ||
          event.chain_depth >= AutomationEngineService.MAX_CHAIN_DEPTH ||
          event.action_count >= AutomationEngineService.MAX_CHAIN_ACTIONS;
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(AutomationRun)
          .values({
            organization_id: event.organization_id,
            project_id: event.project_id,
            rule_id: rule.id,
            rule_version_id: rule.published_version_id!,
            event_id: event.id,
            state: blocked ? 'skipped' : 'queued',
            matched: blocked ? false : null,
            condition_trace: blocked
              ? [{ matched: false, code: 'loop_bound' }]
              : null,
            failure_code: blocked ? 'loop_bound' : null,
          })
          .orIgnore()
          .execute();
      }
    }
  }

  async executeRun(runId: string) {
    const claimed = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AutomationRun);
      const run = await repo.findOne({
        where: { id: runId },
        relations: ['rule', 'rule.execution_actor', 'rule_version', 'event'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!run || !['queued', 'failed'].includes(run.state)) return null;
      if (
        run.state === 'failed' &&
        !run.failure_code?.startsWith('operational:')
      )
        return null;
      run.state = 'evaluating';
      run.attempt_count += 1;
      run.started_at ??= new Date();
      run.failure_code = null;
      return repo.save(run);
    });
    if (!claimed) return;
    try {
      await this.assertExecutable(claimed);
      const definition = claimed.rule_version
        .definition as unknown as Definition;
      if (
        claimed.event.event_type === AutomationTriggerType.TASK_CREATED &&
        claimed.event.subject_type === 'task'
      ) {
        const refreshed = await this.automationEvents.taskSnapshot(
          this.dataSource.manager,
          Number(claimed.event.subject_id),
        );
        if (refreshed) {
          claimed.event.after_snapshot = refreshed;
          await this.dataSource
            .getRepository(AutomationEvent)
            .update(claimed.event.id, { after_snapshot: refreshed });
        }
      }
      const trace = definition.conditions.map((condition) => ({
        field: condition.field,
        operator: condition.operator,
        matched: this.evaluateCondition(condition, claimed.event),
      }));
      if (trace.some((item) => !item.matched)) {
        await this.finishRun(claimed.id, 'skipped', trace, false, null);
        return;
      }
      await this.dataSource.getRepository(AutomationRun).update(claimed.id, {
        state: 'running',
        condition_trace: trace,
        matched: true,
      });
      for (const action of definition.actions) {
        const fresh = await this.dataSource
          .getRepository(AutomationRule)
          .findOneBy({ id: claimed.rule_id });
        if (!fresh?.active || fresh.archived_at)
          throw this.terminal('rule_disabled');
        await this.executeAction(claimed, action);
      }
      await this.finishRun(claimed.id, 'succeeded', trace, true, null);
    } catch (error) {
      const code = this.errorCode(error);
      await this.finishRun(claimed.id, 'failed', null, null, code);
    }
  }

  private async assertExecutable(run: AutomationRun) {
    const capability = (
      await this.entitlements.resolveOrganization(run.organization_id)
    ).find((item) => item.key === CapabilityKey.RULE_BASED_AUTOMATION);
    if (!capability?.enabled) throw this.terminal('capability_disabled');
    if (!run.rule.active || run.rule.archived_at)
      throw this.terminal('rule_disabled');
    if (!run.rule.execution_actor?.active)
      throw this.terminal('actor_disabled');
    const project = await this.dataSource.getRepository(Project).findOneBy({
      id: run.project_id,
      organization_id: run.organization_id,
    });
    if (!project) throw this.terminal('project_unavailable');
  }

  private evaluateCondition(
    condition: Definition['conditions'][number],
    event: AutomationEvent,
  ) {
    const current = this.fieldValue(condition.field, event);
    const expected = condition.value;
    switch (condition.operator) {
      case AutomationConditionOperator.EQUALS:
        return this.equal(current, expected);
      case AutomationConditionOperator.NOT_EQUALS:
        return !this.equal(current, expected);
      case AutomationConditionOperator.IN:
        return (
          Array.isArray(expected) &&
          expected.some((v) => this.equal(current, v))
        );
      case AutomationConditionOperator.NOT_IN:
        return (
          Array.isArray(expected) &&
          !expected.some((v) => this.equal(current, v))
        );
      case AutomationConditionOperator.IS_SET:
        return current !== undefined && current !== null && current !== '';
      case AutomationConditionOperator.IS_NOT_SET:
        return current === undefined || current === null || current === '';
      case AutomationConditionOperator.GREATER_THAN:
        return this.compare(current, expected) > 0;
      case AutomationConditionOperator.GREATER_THAN_OR_EQUAL:
        return this.compare(current, expected) >= 0;
      case AutomationConditionOperator.LESS_THAN:
        return this.compare(current, expected) < 0;
      case AutomationConditionOperator.LESS_THAN_OR_EQUAL:
        return this.compare(current, expected) <= 0;
      case AutomationConditionOperator.CHANGED_FROM:
        return this.equal(
          this.fieldValue(condition.field, event, true),
          expected,
        );
      case AutomationConditionOperator.CHANGED_TO:
        return this.equal(current, expected);
      default:
        return false;
    }
  }

  private async executeAction(
    run: AutomationRun,
    action: Definition['actions'][number],
  ) {
    const repo = this.dataSource.getRepository(AutomationActionAttempt);
    let attempt = await repo.findOneBy({
      idempotency_key: `${run.id}:${action.key}`,
    });
    if (attempt?.state === 'succeeded') return;
    if (!attempt) {
      attempt = await repo.save(
        repo.create({
          run_id: run.id,
          action_key: action.key,
          idempotency_key: `${run.id}:${action.key}`,
          state: 'pending',
          attempt_number: 0,
          input_snapshot: { type: action.type },
        }),
      );
    }
    attempt.state = 'running';
    attempt.attempt_number += 1;
    attempt.started_at = new Date();
    attempt.failure_code = null;
    await repo.save(attempt);
    try {
      const result = await this.executionContext.run(
        {
          actorId: run.rule.execution_actor_id,
          causationEventId: run.event.id,
          correlationId: run.event.correlation_id,
          ancestorRuleIds: [
            ...(run.event.ancestor_rule_ids ?? []),
            run.rule_id,
          ],
          chainDepth: run.event.chain_depth + 1,
          actionCount: run.event.action_count + 1,
        },
        () =>
          this.dataSource.transaction(async (manager) => {
            const actionResult = await this.applyAction(manager, run, action);
            await manager
              .getRepository(AutomationActionAttempt)
              .update(attempt!.id, {
                state: 'succeeded',
                result_snapshot: actionResult,
                finished_at: new Date(),
                failure_code: null,
              });
            return actionResult;
          }),
      );
      if (action.type === AutomationActionType.NOTIFY) {
        const deliveries = Array.isArray((result as any)?.notifications)
          ? (result as any).notifications
          : [];
        for (const delivery of deliveries) {
          try {
            const notification = await this.dataSource
              .getRepository(Notification)
              .findOneBy({ id: Number(delivery.notificationId) });
            if (notification)
              await this.notificationsService.deliverCommittedNotification({
                ...notification,
                recipient: { id: delivery.recipientId } as User,
              });
          } catch (error) {
            AppLogger.error(
              'AutomationEngineService',
              `Notification ${delivery.notificationId} committed but realtime delivery failed`,
            );
          }
        }
      }
      if (
        Number((result as any)?.taskId) > 0 &&
        action.type !== AutomationActionType.NOTIFY
      ) {
        this.projectsGateway.emitTaskUpdated({
          projectId: run.project_id,
          taskId: Number((result as any).taskId),
          source: 'automation',
          actionType: action.type,
          runId: run.id,
        });
      }
    } catch (error) {
      attempt.state = 'failed';
      attempt.failure_code = this.errorCode(error);
      attempt.finished_at = new Date();
      await repo.save(attempt);
      throw error;
    }
  }

  private async applyAction(
    manager: EntityManager,
    run: AutomationRun,
    action: Definition['actions'][number],
  ) {
    const taskId = Number(
      run.event.subject_type === 'task'
        ? run.event.subject_id
        : (run.event.after_snapshot as any)?.taskId,
    );
    const task = await manager.getRepository(Task).findOne({
      where: { id: taskId, organization_id: run.organization_id },
      relations: ['project', 'status', 'assignees'],
    });
    if (!task || task.project.id !== run.project_id)
      throw this.terminal('task_unavailable');
    if (action.type === AutomationActionType.ASSIGN) {
      const user = await this.assertMember(
        manager,
        run,
        Number(action.config.memberId),
      );
      task.assignees = [
        ...(task.assignees ?? []).filter((x) => x.id !== user.id),
        user,
      ];
      await manager.getRepository(Task).save(task);
    } else if (action.type === AutomationActionType.UPDATE_FIELD) {
      const field = String(action.config.field);
      if (field.startsWith('custom:')) {
        await this.customFields.setTaskValuesInTransaction(
          manager,
          run.organization_id,
          run.project_id,
          task.id,
          [{ fieldId: field.slice(7), value: action.config.value }],
          false,
        );
      } else {
        if (
          ![
            'title',
            'description',
            'priority',
            'severity',
            'due_date',
          ].includes(field)
        )
          throw this.terminal('field_unsupported');
        (task as any)[field] =
          field === 'due_date' && action.config.value
            ? new Date(action.config.value)
            : action.config.value;
        await manager.getRepository(Task).save(task);
      }
    } else if (action.type === AutomationActionType.TRANSITION_STATUS) {
      await this.applyStatus(
        manager,
        run,
        task,
        Number(action.config.statusId),
      );
    } else if (action.type === AutomationActionType.ADD_WATCHER) {
      const user = await this.assertMember(
        manager,
        run,
        Number(action.config.memberId),
      );
      await manager
        .createQueryBuilder()
        .insert()
        .into(TaskWatcher)
        .values({
          task_id: task.id,
          user_id: user.id,
          organization_id: run.organization_id,
        })
        .orIgnore()
        .execute();
    } else if (action.type === AutomationActionType.NOTIFY) {
      const ids = action.config.recipientMemberIds.map(Number);
      for (const id of ids) await this.assertMember(manager, run, id);
      const notifications = await manager.getRepository(Notification).save(
        ids.map((id) => ({
          recipient: { id } as User,
          sender: null,
          title: 'Tailpoint Automation',
          message: action.config.message || 'An automation rule matched.',
          type: 'automation',
          organization_id: run.organization_id,
          created_at: new Date(),
          metadata: {
            projectId: run.project_id,
            taskId: task.id,
            automationRunId: run.id,
            deliveryKey: `${run.id}:${action.key}:${id}`,
          },
        })),
      );
      return {
        type: action.type,
        taskId: task.id,
        notifications: notifications.map((notification, index) => ({
          notificationId: notification.id,
          recipientId: ids[index],
        })),
      };
    } else if (action.type === AutomationActionType.CREATE_TASK_FROM_TEMPLATE) {
      await this.createFromTemplate(manager, run, action, task);
    }
    return { type: action.type, taskId: task.id };
  }

  private async applyStatus(
    manager: EntityManager,
    run: AutomationRun,
    task: Task,
    statusId: number,
  ) {
    const status = await manager
      .getRepository(Status)
      .findOne({ where: { id: statusId, project: { id: run.project_id } } });
    if (!status) throw this.terminal('status_unavailable');
    const transition = await manager
      .getRepository(ProjectWorkflowTransition)
      .createQueryBuilder('transition')
      .innerJoin('transition.version', 'version')
      .innerJoin('version.workflow', 'workflow')
      .innerJoin('transition.source', 'source')
      .innerJoin('source.status', 'sourceStatus')
      .innerJoin('transition.destination', 'destination')
      .innerJoin('destination.status', 'destinationStatus')
      .where(
        'workflow.project_id = :projectId AND workflow.organization_id = :organizationId',
        { projectId: run.project_id, organizationId: run.organization_id },
      )
      .andWhere("version.state = 'published'")
      .andWhere('sourceStatus.id = :source')
      .andWhere('destinationStatus.id = :destination')
      .setParameters({ source: task.status.id, destination: statusId })
      .getOne();
    if (
      !transition ||
      !transition.allowed_roles.includes(run.rule.authorization_policy as any)
    )
      throw this.terminal('transition_denied');
    await this.validateTransitionRequirements(manager, task, transition);
    task.status = status;
    await manager.getRepository(Task).save(task);
  }

  private async validateTransitionRequirements(
    manager: EntityManager,
    task: Task,
    transition: ProjectWorkflowTransition,
  ) {
    const missing: string[] = [];
    for (const field of transition.requirements?.standardFields ?? []) {
      const value = (task as any)[field];
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && !value.length)
      )
        missing.push(field);
    }
    const customIds = transition.requirements?.customFieldIds ?? [];
    if (customIds.length) {
      const values = await manager.getRepository(TaskCustomFieldValue).find({
        where: { task_id: task.id },
      });
      const present = new Set(values.map((value) => value.definition_id));
      customIds
        .filter((id) => !present.has(id))
        .forEach((id) => missing.push(`custom:${id}`));
    }
    if (missing.length) throw this.terminal('transition_requirements_missing');
  }

  private async createFromTemplate(
    manager: EntityManager,
    run: AutomationRun,
    action: any,
    source: Task,
  ) {
    const template = await manager.getRepository(ReusableTemplate).findOne({
      where: {
        id: action.config.templateId,
        organization_id: run.organization_id,
      },
      relations: ['versions'],
    });
    if (
      !template ||
      template.archived_at ||
      template.type !== ReusableTemplateType.TASK
    )
      throw this.terminal('template_unavailable');
    const version = [...template.versions].sort(
      (a, b) => b.version_number - a.version_number,
    )[0];
    const snapshot: any = version?.snapshot;
    if (!snapshot?.title) throw this.terminal('template_invalid');
    const status =
      (await manager.getRepository(Status).findOne({
        where: { project: { id: run.project_id }, isDefault: true },
      })) ?? source.status;
    const project = await manager.getRepository(Project).findOne({
      where: { id: run.project_id, organization_id: run.organization_id },
      relations: ['user'],
    });
    if (!project?.user) throw this.terminal('project_owner_unavailable');
    await manager.getRepository(Task).save({
      title: snapshot.title,
      description: snapshot.description || '',
      priority: snapshot.priority ?? 0,
      severity: snapshot.severity ?? null,
      due_date: null,
      organization_id: run.organization_id,
      project: { id: run.project_id } as Project,
      status,
      user: project.user,
      assignees: [],
    });
  }

  private async assertMember(
    manager: EntityManager,
    run: AutomationRun,
    userId: number,
  ) {
    const project = await manager
      .getRepository(Project)
      .findOne({ where: { id: run.project_id }, relations: ['user'] });
    if (Number(project?.user?.id) === Number(userId)) return project.user;
    const peer = await manager.getRepository(ProjectPeer).findOne({
      where: {
        project: { id: run.project_id },
        user: { id: userId },
        organization_id: run.organization_id,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
      relations: ['user'],
    });
    if (!peer) throw this.terminal('member_unavailable');
    return peer.user;
  }

  private fieldValue(
    field: string,
    event: AutomationEvent,
    before = false,
  ): unknown {
    const snapshot: any = before ? event.before_snapshot : event.after_snapshot;
    if (field === 'actor_id')
      return event.actor_id ? Number(event.actor_id) : null;
    if (field === 'project_id') return event.project_id;
    if (field.startsWith('custom:'))
      return (
        snapshot?.customFields?.[field.slice(7)] ??
        snapshot?.task?.customFields?.[field.slice(7)]
      );
    const map: Record<string, string> = {
      due_date: 'dueDate',
      status_id: 'statusId',
      assignee_ids: 'assigneeIds',
    };
    return (
      snapshot?.task?.[map[field] ?? field] ?? snapshot?.[map[field] ?? field]
    );
  }

  private equal(a: unknown, b: unknown) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  private compare(a: unknown, b: unknown) {
    const numeric = [a, b].every((v) => typeof v === 'number');
    if (numeric) return Number(a) - Number(b);
    const ad = new Date(String(a)).getTime(),
      bd = new Date(String(b)).getTime();
    if (!Number.isNaN(ad) && !Number.isNaN(bd)) return ad - bd;
    return String(a).localeCompare(String(b));
  }
  private terminal(code: string) {
    return new BadRequestException({ code: `terminal:${code}` });
  }
  private errorCode(error: any) {
    const response = error?.getResponse?.();
    const code = typeof response === 'object' ? response?.code : null;
    return code ?? `operational:${error?.code ?? 'execution_failed'}`;
  }
  private async finishRun(
    id: string,
    state: any,
    trace: any,
    matched: boolean | null,
    failure: string | null,
  ) {
    const current = await this.dataSource.getRepository(AutomationRun).findOne({
      where: { id },
      relations: ['rule', 'rule.execution_actor', 'event'],
    });
    if (!current) return;
    const auditEnabled = Boolean(
      (
        await this.entitlements.resolveOrganization(current.organization_id)
      ).find((item) => item.key === CapabilityKey.ADVANCED_AUDIT_TRAIL)
        ?.enabled,
    );
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(AutomationRun);
      const run = await repository.findOne({
        where: { id },
        relations: ['rule', 'rule.execution_actor', 'event'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) return;
      const previousState = run.state;
      run.state = state;
      if (trace) run.condition_trace = trace;
      if (matched !== null) run.matched = matched;
      run.failure_code = failure;
      run.finished_at = new Date();
      await repository.save(run);
      if (auditEnabled) {
        await this.auditWriter.append(manager, {
          organizationId: run.organization_id,
          projectId: run.project_id,
          action:
            state === 'failed'
              ? AuditAction.AUTOMATION_RUN_FAILED
              : AuditAction.AUTOMATION_RUN_COMPLETED,
          actor: {
            type: AuditActorType.AUTOMATION,
            id: run.rule.execution_actor?.id ?? null,
            label:
              run.rule.execution_actor?.display_name ?? 'Tailpoint Automation',
            responsibleUserId: run.rule.last_material_editor_id,
          },
          subject: {
            type: AuditSubjectType.AUTOMATION_RUN,
            id: run.id,
            label: run.rule.name,
          },
          source: AuditSource.AUTOMATION,
          correlationId:
            run.event?.correlation_id ?? this.auditWriter.correlationId(),
          causationId: run.event_id,
          sourceEventKey: `run-finished:${run.id}:${run.attempt_count}`,
          before: { status: previousState, rule_id: run.rule_id },
          after: {
            status: state,
            rule_id: run.rule_id,
            reason: failure,
          },
        });
      }
    });
  }
}
