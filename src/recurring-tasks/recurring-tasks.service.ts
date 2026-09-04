import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { Task } from 'src/typeorm/entities/Task';
import { Status } from 'src/typeorm/entities/Status';
import {
  RecurrenceFrequency,
  RecurrenceGenerationMode,
  RecurrenceHolidayPolicy,
  TaskRecurrence,
} from 'src/typeorm/entities/TaskRecurrence';
import { TaskRecurrenceOccurrence } from 'src/typeorm/entities/TaskRecurrenceOccurrence';
import { AuthUser } from 'src/types/users';
import { EntityManager, LessThanOrEqual, Repository } from 'typeorm';
import { CreateRecurrenceDto, UpdateRecurrenceDto } from './dto/recurrence.dto';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { TaskRecurrenceException } from 'src/typeorm/entities/TaskRecurrenceException';
import { TaskDependency } from 'src/typeorm/entities/TaskDependency';
import { ReusableTemplateVersion } from 'src/typeorm/entities/ReusableTemplateVersion';
import {
  AdvancedRecurrenceConfigDto,
  EffectiveRecurrenceChangeDto,
  RecurrenceExceptionDto,
} from './dto/recurrence.dto';

@Injectable()
export class RecurringTasksService {
  constructor(
    @InjectRepository(TaskRecurrence)
    private recurrences: Repository<TaskRecurrence>,
    @InjectRepository(TaskRecurrenceOccurrence)
    private occurrences: Repository<TaskRecurrenceOccurrence>,
    @InjectRepository(TaskRecurrenceException)
    private exceptions: Repository<TaskRecurrenceException>,
    @InjectRepository(Task) private tasks: Repository<Task>,
    @InjectRepository(Status) private statuses: Repository<Status>,
    @InjectRepository(TaskDependency)
    private taskDependencies: Repository<TaskDependency>,
    @InjectRepository(ReusableTemplateVersion)
    private templateVersions: Repository<ReusableTemplateVersion>,
    private authorization: AuthorizationService,
    private entitlements: EntitlementsService,
  ) {}

  private validateTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException('Invalid IANA timezone');
    }
  }

  private validateRuleInput(
    dto: Omit<CreateRecurrenceDto, 'template_task_id'>,
  ) {
    this.validateTimezone(dto.timezone);
    if (!Object.values(RecurrenceFrequency).includes(dto.frequency))
      throw new BadRequestException('Invalid recurrence frequency');
    if (!Object.values(RecurrenceGenerationMode).includes(dto.generation_mode))
      throw new BadRequestException('Invalid recurrence generation mode');
    if (!Number.isInteger(dto.interval) || dto.interval < 1)
      throw new BadRequestException('Recurrence interval must be at least 1');
    if (Number.isNaN(dto.next_due_at?.getTime()))
      throw new BadRequestException('Invalid recurrence due date');
    if (dto.end_at && Number.isNaN(dto.end_at.getTime()))
      throw new BadRequestException('Invalid recurrence end date');
    if (dto.end_at && dto.end_at < dto.next_due_at)
      throw new BadRequestException(
        'Recurrence end date must follow its first due date',
      );
    if (dto.frequency === RecurrenceFrequency.WEEKDAYS && !dto.weekdays?.length)
      throw new BadRequestException('weekdays are required');
  }

  private generationAt(due: Date, days: number) {
    return new Date(due.getTime() - days * 86_400_000);
  }

  private zonedParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    return {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      hour: value('hour'),
      minute: value('minute'),
      second: value('second'),
    };
  }

  private wallTimeToUtc(
    parts: ReturnType<RecurringTasksService['zonedParts']>,
    timezone: string,
  ) {
    let guess = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const displayed = this.zonedParts(new Date(guess), timezone);
      const displayedAsUtc = Date.UTC(
        displayed.year,
        displayed.month - 1,
        displayed.day,
        displayed.hour,
        displayed.minute,
        displayed.second,
      );
      guess +=
        Date.UTC(
          parts.year,
          parts.month - 1,
          parts.day,
          parts.hour,
          parts.minute,
          parts.second,
        ) - displayedAsUtc;
    }
    return new Date(guess);
  }

  private nextDue(rule: TaskRecurrence, current: Date): Date {
    const local = this.zonedParts(current, rule.timezone);
    const calendar = new Date(
      Date.UTC(
        local.year,
        local.month - 1,
        local.day,
        local.hour,
        local.minute,
        local.second,
      ),
    );
    if (rule.frequency === RecurrenceFrequency.DAILY)
      calendar.setUTCDate(calendar.getUTCDate() + rule.interval);
    if (rule.frequency === RecurrenceFrequency.WEEKLY)
      calendar.setUTCDate(calendar.getUTCDate() + 7 * rule.interval);
    if (rule.frequency === RecurrenceFrequency.MONTHLY)
      calendar.setUTCMonth(calendar.getUTCMonth() + rule.interval);
    if (rule.frequency === RecurrenceFrequency.WEEKDAYS) {
      const weekdays = new Set(rule.weekdays ?? [1, 2, 3, 4, 5]);
      do calendar.setUTCDate(calendar.getUTCDate() + 1);
      while (!weekdays.has(calendar.getUTCDay()));
    }
    return this.wallTimeToUtc(
      {
        year: calendar.getUTCFullYear(),
        month: calendar.getUTCMonth() + 1,
        day: calendar.getUTCDate(),
        hour: calendar.getUTCHours(),
        minute: calendar.getUTCMinutes(),
        second: calendar.getUTCSeconds(),
      },
      rule.timezone,
    );
  }

  private localDateKey(date: Date, timezone: string) {
    const parts = this.zonedParts(date, timezone);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
      parts.day,
    ).padStart(2, '0')}`;
  }

  private isNonBusinessDay(rule: TaskRecurrence, date: Date) {
    const local = this.zonedParts(date, rule.timezone);
    const weekday = new Date(
      Date.UTC(local.year, local.month - 1, local.day),
    ).getUTCDay();
    return (
      weekday === 0 ||
      weekday === 6 ||
      (rule.holiday_dates ?? []).includes(
        this.localDateKey(date, rule.timezone),
      )
    );
  }

  private resolveBusinessDate(rule: TaskRecurrence, scheduled: Date) {
    if (
      !rule.advanced_enabled ||
      rule.holiday_policy === RecurrenceHolidayPolicy.NONE
    )
      return scheduled;
    if (
      rule.holiday_policy === RecurrenceHolidayPolicy.SKIP &&
      this.isNonBusinessDay(rule, scheduled)
    )
      return null;
    let resolved = new Date(scheduled);
    while (this.isNonBusinessDay(rule, resolved)) {
      resolved = this.wallTimeToUtc(
        {
          ...this.zonedParts(resolved, rule.timezone),
          day: this.zonedParts(resolved, rule.timezone).day + 1,
        },
        rule.timezone,
      );
    }
    return resolved;
  }

  async configureAdvanced(
    id: number,
    dto: AdvancedRecurrenceConfigDto,
    actor: AuthUser,
    organizationId: string,
  ) {
    await this.entitlements.assertCapability(
      actor,
      organizationId,
      CapabilityKey.ADVANCED_RECURRING_WORK,
    );
    const rule = await this.owned(id, actor, organizationId);
    const allowedAssignees = new Set(
      (rule.template_task.assignees ?? []).map((user) => user.id),
    );
    if (
      (dto.assignee_rotation_ids ?? []).some(
        (userId) => !allowedAssignees.has(userId),
      )
    )
      throw new BadRequestException(
        'Rotation users must already be assigned to the template task',
      );
    rule.advanced_enabled = true;
    rule.holiday_policy = dto.holiday_policy;
    rule.holiday_dates = [...new Set(dto.holiday_dates ?? [])].sort();
    rule.assignee_rotation_ids = [...new Set(dto.assignee_rotation_ids ?? [])];
    if (dto.reusable_template_version_id) {
      const version = await this.templateVersions.findOne({
        where: { id: dto.reusable_template_version_id },
        relations: ['template'],
      });
      if (!version || version.template.organization_id !== organizationId)
        throw new NotFoundException('Reusable template version not found');
      rule.reusable_template_version_id = version.id;
    }
    rule.rotation_index = 0;
    return { success: true, data: await this.recurrences.save(rule) };
  }

  async addException(
    id: number,
    dto: RecurrenceExceptionDto,
    actor: AuthUser,
    organizationId: string,
  ) {
    await this.entitlements.assertCapability(
      actor,
      organizationId,
      CapabilityKey.ADVANCED_RECURRING_WORK,
    );
    await this.owned(id, actor, organizationId);
    if (dto.action === 'reschedule' && !dto.rescheduled_due_at)
      throw new BadRequestException('A rescheduled due date is required');
    const existing = await this.exceptions.findOneBy({
      recurrence_id: id,
      scheduled_due_at: dto.scheduled_due_at,
    });
    const exception = existing ?? this.exceptions.create({ recurrence_id: id });
    Object.assign(exception, {
      ...dto,
      rescheduled_due_at:
        dto.action === 'reschedule' ? dto.rescheduled_due_at : null,
      created_by_id: actor.userId,
    });
    return { success: true, data: await this.exceptions.save(exception) };
  }

  async scheduleFutureChange(
    id: number,
    dto: EffectiveRecurrenceChangeDto,
    actor: AuthUser,
    organizationId: string,
  ) {
    await this.entitlements.assertCapability(
      actor,
      organizationId,
      CapabilityKey.ADVANCED_RECURRING_WORK,
    );
    const rule = await this.owned(id, actor, organizationId);
    if (dto.effective_at <= new Date())
      throw new BadRequestException('Effective date must be in the future');
    const allowed = [
      'frequency',
      'interval',
      'weekdays',
      'timezone',
      'generation_mode',
      'generate_before_days',
      'end_at',
    ];
    rule.pending_changes = Object.fromEntries(
      Object.entries(dto.changes).filter(([key]) => allowed.includes(key)),
    );
    rule.changes_effective_at = dto.effective_at;
    await this.recurrences.save(rule);
    return {
      success: true,
      data: {
        effective_at: rule.changes_effective_at,
        changes: rule.pending_changes,
        affectedGeneratedTasks: 0,
      },
    };
  }

  private async applyPendingChanges(rule: TaskRecurrence) {
    if (
      !rule.pending_changes ||
      !rule.changes_effective_at ||
      rule.next_due_at < rule.changes_effective_at
    )
      return;
    this.recurrences.merge(rule, rule.pending_changes);
    rule.pending_changes = null;
    rule.changes_effective_at = null;
    await this.recurrences.save(rule);
  }

  private async inheritDependencies(rule: TaskRecurrence, task: Task) {
    const capabilities = await this.entitlements.resolveOrganization(
      rule.organization_id,
    );
    if (
      !capabilities.find((item) => item.key === CapabilityKey.TASK_DEPENDENCIES)
        ?.enabled
    )
      return;
    const sourceEdges = await this.taskDependencies.findBy({
      organization_id: rule.organization_id,
      task_id: rule.template_task_id,
      active: true,
    });
    if (!sourceEdges.length) return;
    await this.taskDependencies.save(
      sourceEdges.map((edge) =>
        this.taskDependencies.create({
          organization_id: rule.organization_id,
          task_id: task.id,
          depends_on_task_id: edge.depends_on_task_id,
          task_title_snapshot: task.title,
          depends_on_title_snapshot: edge.depends_on_title_snapshot,
          created_by_user_id: rule.created_by_id,
          removed_by_user_id: null,
          removal_reason: null,
          active: true,
        }),
      ),
    );
  }

  async history(id: number, actor: AuthUser, organizationId: string) {
    const rule = await this.owned(id, actor, organizationId);
    const [occurrences, exceptions] = await Promise.all([
      this.occurrences.find({
        where: { recurrence_id: id },
        order: { scheduled_due_at: 'DESC' },
        take: 100,
      }),
      this.exceptions.find({
        where: { recurrence_id: id },
        order: { scheduled_due_at: 'DESC' },
        take: 100,
      }),
    ]);
    return {
      success: true,
      data: {
        recurrenceId: rule.id,
        occurrences,
        exceptions,
        recovery: {
          consecutiveFailures: rule.consecutive_failures,
          lastErrorCode: rule.last_error_code,
        },
      },
    };
  }

  async create(
    projectId: number,
    dto: CreateRecurrenceDto,
    actor: AuthUser,
    organizationId: string,
  ) {
    const { project } = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.CONTRIBUTE,
    );
    this.validateRuleInput(dto);
    const template = await this.tasks.findOne({
      where: { id: dto.template_task_id, organization_id: organizationId },
      relations: ['project'],
    });
    if (!template || template.project.id !== projectId)
      throw new NotFoundException('Template task not found');
    const rule = this.recurrences.create({
      ...dto,
      project,
      project_id: projectId,
      template_task: template,
      template_task_id: template.id,
      organization_id: organizationId,
      created_by_id: actor.userId,
      weekdays: dto.weekdays ?? null,
      end_at: dto.end_at ?? null,
      next_generation_at:
        dto.generation_mode === RecurrenceGenerationMode.BEFORE_DUE
          ? this.generationAt(dto.next_due_at, dto.generate_before_days)
          : null,
    });
    return { success: 'success', data: await this.recurrences.save(rule) };
  }

  async createForTaskInTransaction(
    manager: EntityManager,
    task: Task,
    dto: Omit<CreateRecurrenceDto, 'template_task_id'>,
    actor: AuthUser,
    organizationId: string,
  ) {
    await this.entitlements.assertCapability(
      actor,
      organizationId,
      CapabilityKey.RECURRING_TASKS,
    );
    this.validateRuleInput(dto);
    const repository = manager.getRepository(TaskRecurrence);
    return repository.save(
      repository.create({
        ...dto,
        project: task.project,
        project_id: task.project.id,
        template_task: task,
        template_task_id: task.id,
        organization_id: organizationId,
        created_by_id: actor.userId,
        weekdays: dto.weekdays ?? null,
        end_at: dto.end_at ?? null,
        next_generation_at:
          dto.generation_mode === RecurrenceGenerationMode.BEFORE_DUE
            ? this.generationAt(dto.next_due_at, dto.generate_before_days)
            : null,
      }),
    );
  }

  async list(projectId: number, actor: AuthUser, organizationId: string) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    return {
      success: 'success',
      data: await this.recurrences.find({
        where: { project_id: projectId, organization_id: organizationId },
        order: { id: 'DESC' },
      }),
    };
  }

  async summaryForTask(
    taskId: number,
    actor: AuthUser,
    organizationId: string,
  ) {
    const task = await this.tasks.findOne({
      where: { id: taskId, organization_id: organizationId },
      relations: ['project'],
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      task.project.id,
      ProjectPermission.VIEW,
    );
    const templateRule = await this.recurrences.findOne({
      where: { template_task_id: taskId, organization_id: organizationId },
    });
    if (templateRule)
      return {
        success: 'success',
        data: {
          kind: 'template',
          recurrence: templateRule,
          previous_task_id: null,
        },
      };
    const occurrence = await this.occurrences.findOne({
      where: { task_id: taskId },
      relations: ['recurrence'],
    });
    return {
      success: 'success',
      data: occurrence
        ? {
            kind: 'occurrence',
            recurrence: occurrence.recurrence,
            previous_task_id: occurrence.previous_task_id,
          }
        : null,
    };
  }

  private async owned(id: number, actor: AuthUser, organizationId: string) {
    const rule = await this.recurrences.findOne({
      where: { id, organization_id: organizationId },
      relations: ['project', 'template_task', 'template_task.assignees'],
    });
    if (!rule) throw new NotFoundException('Recurrence not found');
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      rule.project_id,
      ProjectPermission.EDIT,
    );
    return rule;
  }

  async update(
    id: number,
    dto: UpdateRecurrenceDto,
    actor: AuthUser,
    organizationId: string,
  ) {
    const rule = await this.owned(id, actor, organizationId);
    if (dto.timezone) this.validateTimezone(dto.timezone);
    this.recurrences.merge(rule, dto);
    if (
      dto.next_due_at ||
      dto.generate_before_days !== undefined ||
      dto.generation_mode
    )
      rule.next_generation_at =
        rule.generation_mode === RecurrenceGenerationMode.BEFORE_DUE
          ? this.generationAt(rule.next_due_at, rule.generate_before_days)
          : null;
    return { success: 'success', data: await this.recurrences.save(rule) };
  }

  async updateFutureTemplate(
    id: number,
    payload: Record<string, unknown>,
    actor: AuthUser,
    organizationId: string,
  ) {
    const rule = await this.owned(id, actor, organizationId);
    const allowed = [
      'title',
      'description',
      'description_html',
      'priority',
      'severity',
    ];
    const changes = Object.fromEntries(
      Object.entries(payload).filter(([key]) => allowed.includes(key)),
    );
    if (payload.status) {
      const status = await this.statuses.findOne({
        where: {
          id: Number(payload.status),
          organization_id: organizationId,
        },
        relations: ['project'],
      });
      if (!status || status.project?.id !== rule.project_id)
        throw new BadRequestException(
          'Status does not belong to the recurring task project',
        );
      rule.template_task.status = status;
    }
    this.tasks.merge(rule.template_task, changes);
    await this.tasks.save(rule.template_task);
    return { success: 'success', data: rule.template_task };
  }

  async remove(id: number, actor: AuthUser, organizationId: string) {
    const rule = await this.owned(id, actor, organizationId);
    await this.recurrences.remove(rule);
    return { success: 'success', data: { id } };
  }

  async generate(rule: TaskRecurrence) {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 120_000);
    const claim = await this.recurrences
      .createQueryBuilder()
      .update(TaskRecurrence)
      .set({ generation_lease_until: leaseUntil })
      .where('id = :id', { id: rule.id })
      .andWhere(
        '(generation_lease_until IS NULL OR generation_lease_until <= :now)',
        { now },
      )
      .execute();
    if (!claim.affected) {
      const claimedOccurrence = await this.occurrences.findOne({
        where: {
          recurrence_id: rule.id,
          scheduled_due_at: rule.next_due_at,
        },
      });
      return claimedOccurrence?.task ?? null;
    }
    await this.applyPendingChanges(rule);
    const existing = await this.occurrences.findOne({
      where: { recurrence_id: rule.id, scheduled_due_at: rule.next_due_at },
    });
    if (existing) {
      await this.recurrences.update(
        { id: rule.id },
        { generation_lease_until: null },
      );
      return existing.task;
    }
    const scheduledDue = new Date(rule.next_due_at);
    const exception = await this.exceptions.findOneBy({
      recurrence_id: rule.id,
      scheduled_due_at: scheduledDue,
    });
    let resolvedDue =
      exception?.action === 'reschedule'
        ? exception.rescheduled_due_at
        : this.resolveBusinessDate(rule, scheduledDue);
    if (exception?.action === 'skip') resolvedDue = null;
    const template =
      rule.template_task ??
      (await this.tasks.findOne({
        where: { id: rule.template_task_id },
        relations: ['project', 'status', 'assignees', 'organization'],
      }));
    if (!template) throw new NotFoundException('Template task not found');
    const previous = await this.occurrences.findOne({
      where: { recurrence_id: rule.id },
      order: { scheduled_due_at: 'DESC' },
    });
    if (!resolvedDue) {
      await this.occurrences.save(
        this.occurrences.create({
          recurrence: rule,
          recurrence_id: rule.id,
          task: null,
          task_id: null,
          scheduled_due_at: scheduledDue,
          previous_task_id: previous?.task_id ?? null,
          outcome: 'skipped',
          failure_code: null,
          resolved_due_at: null,
        }),
      );
      rule.next_due_at = this.nextDue(rule, scheduledDue);
      rule.next_generation_at =
        rule.generation_mode === RecurrenceGenerationMode.BEFORE_DUE
          ? this.generationAt(rule.next_due_at, rule.generate_before_days)
          : null;
      await this.recurrences.save(rule);
      await this.recurrences.update(
        { id: rule.id },
        { generation_lease_until: null },
      );
      return null;
    }
    const rotation = rule.advanced_enabled
      ? rule.assignee_rotation_ids ?? []
      : [];
    const rotatedAssignees = rotation.length
      ? (template.assignees ?? []).filter(
          (user) => user.id === rotation[rule.rotation_index % rotation.length],
        )
      : template.assignees;
    const pinnedVersion = rule.reusable_template_version_id
      ? await this.templateVersions.findOneBy({
          id: rule.reusable_template_version_id,
        })
      : null;
    const pinnedTask = (pinnedVersion?.snapshot?.task ??
      pinnedVersion?.snapshot ??
      {}) as Record<string, unknown>;
    const task = await this.tasks.save(
      this.tasks.create({
        title: String(pinnedTask.title ?? template.title),
        description: String(
          pinnedTask.description ?? template.description ?? '',
        ),
        description_html: String(
          pinnedTask.description_html ?? template.description_html ?? '',
        ),
        priority: Number(pinnedTask.priority ?? template.priority),
        severity:
          String(pinnedTask.severity ?? template.severity ?? '') || null,
        due_date: resolvedDue,
        project: template.project,
        status: template.status,
        assignees: rotatedAssignees,
        organization: template.organization,
        organization_id: rule.organization_id,
      }),
    );
    await this.inheritDependencies(rule, task);
    await this.occurrences.save(
      this.occurrences.create({
        recurrence: rule,
        recurrence_id: rule.id,
        task,
        task_id: task.id,
        scheduled_due_at: scheduledDue,
        previous_task_id: previous?.task_id ?? null,
        outcome: 'generated',
        failure_code: null,
        resolved_due_at: resolvedDue,
      }),
    );
    rule.last_generated_at = new Date();
    rule.next_due_at = this.nextDue(rule, scheduledDue);
    if (rotation.length)
      rule.rotation_index = (rule.rotation_index + 1) % rotation.length;
    rule.consecutive_failures = 0;
    rule.last_error_code = null;
    rule.next_generation_at =
      rule.generation_mode === RecurrenceGenerationMode.BEFORE_DUE
        ? this.generationAt(rule.next_due_at, rule.generate_before_days)
        : null;
    if (rule.end_at && rule.next_due_at > rule.end_at) rule.active = false;
    await this.recurrences.save(rule);
    await this.recurrences.update(
      { id: rule.id },
      { generation_lease_until: null },
    );
    return task;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scan() {
    const due = await this.recurrences.find({
      where: {
        active: true,
        generation_mode: RecurrenceGenerationMode.BEFORE_DUE,
        next_generation_at: LessThanOrEqual(new Date()),
      },
      relations: [
        'template_task',
        'template_task.project',
        'template_task.status',
        'template_task.assignees',
        'template_task.organization',
      ],
    });
    for (const rule of due) {
      try {
        await this.generate(rule);
      } catch {
        rule.consecutive_failures = (rule.consecutive_failures ?? 0) + 1;
        rule.last_error_code = 'generation_failed';
        await this.recurrences.save(rule);
        // Leave the rule due so a later scheduler pass can retry it.
      }
    }
  }

  async generateAfterCompletion(taskId: number) {
    const occurrence = await this.occurrences.findOne({
      where: { task_id: taskId },
      relations: ['recurrence', 'recurrence.template_task'],
    });
    const recurrence =
      occurrence?.recurrence ??
      (await this.recurrences.findOne({
        where: { template_task_id: taskId, active: true },
        relations: [
          'template_task',
          'template_task.project',
          'template_task.status',
          'template_task.assignees',
          'template_task.organization',
        ],
      }));
    if (
      recurrence?.active &&
      recurrence.generation_mode === RecurrenceGenerationMode.ON_COMPLETION
    ) {
      return this.generate(recurrence);
    }
  }
}
