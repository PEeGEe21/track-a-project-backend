import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { AutomationActor } from 'src/typeorm/entities/AutomationActor';
import { AutomationEvent } from 'src/typeorm/entities/AutomationEvent';
import { AutomationRun } from 'src/typeorm/entities/AutomationRun';
import { TaskWatcher } from 'src/typeorm/entities/TaskWatcher';
import { Task } from 'src/typeorm/entities/Task';
import { AutomationRule } from 'src/typeorm/entities/AutomationRule';
import {
  AutomationRuleDefinition,
  AutomationRuleVersion,
} from 'src/typeorm/entities/AutomationRuleVersion';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { RequestForm } from 'src/typeorm/entities/RequestForm';
import {
  ReusableTemplate,
  ReusableTemplateType,
} from 'src/typeorm/entities/ReusableTemplate';
import { Status } from 'src/typeorm/entities/Status';
import { User } from 'src/typeorm/entities/User';
import { AuthUser } from 'src/types/users';
import { ActivityType } from 'src/utils/constants/activity';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  AUTOMATION_STANDARD_FIELDS,
  AutomationActionType,
  AutomationConditionOperator,
  AutomationTriggerType,
  AUTOMATION_INGESTION_FIELDS,
  CHANGE_CONDITION_OPERATORS,
  NO_VALUE_CONDITION_OPERATORS,
} from './automation-contract';
import {
  AutomationDefinitionDto,
  CreateAutomationRuleDto,
  UpdateAutomationDraftDto,
  DryRunAutomationDto,
  ListAutomationRunsQueryDto,
} from './dto/automation.dto';

@Injectable()
export class AutomationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    includeArchived: boolean,
  ) {
    const context = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    const canEdit = this.canEdit(context.role, actor);
    const rules = await this.dataSource.getRepository(AutomationRule).find({
      where: {
        organization_id: organizationId,
        project_id: projectId,
        ...(!canEdit || !includeArchived ? { archived_at: IsNull() } : {}),
        ...(!canEdit ? { active: true } : {}),
      },
      relations: ['published_version', 'draft_version'],
      order: { updated_at: 'DESC' },
      take: 200,
    });
    return {
      success: true,
      data: rules.map((rule) => this.serialize(rule, canEdit)),
    };
  }

  async get(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    ruleId: string,
  ) {
    const context = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    const rule = await this.findScoped(
      this.dataSource.manager,
      organizationId,
      projectId,
      ruleId,
    );
    const canEdit = this.canEdit(context.role, actor);
    if (!canEdit && !rule.active)
      throw new NotFoundException('Automation rule not found');
    return {
      success: true,
      data: this.serialize(rule, canEdit),
    };
  }

  async create(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    dto: CreateAutomationRuleDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    const definition = await this.validateDefinition(
      organizationId,
      projectId,
      dto,
    );
    const id = await this.dataSource.transaction(async (manager) => {
      const executionActor = await this.ensureAutomationActor(
        manager,
        organizationId,
      );
      const ruleRepo = manager.getRepository(AutomationRule);
      const rule = await ruleRepo.save(
        ruleRepo.create({
          organization_id: organizationId,
          project_id: projectId,
          stable_key: `rule_${randomUUID().replace(/-/g, '')}`,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          authorization_policy: dto.authorizationPolicy ?? 'editor',
          execution_actor_id: executionActor.id,
          created_by_id: actor.userId,
          last_material_editor_id: actor.userId,
        }),
      );
      const versionRepo = manager.getRepository(AutomationRuleVersion);
      const draft = await versionRepo.save(
        versionRepo.create({
          rule_id: rule.id,
          version_number: 1,
          state: 'draft',
          schema_version: 1,
          definition,
          created_by_id: actor.userId,
        }),
      );
      rule.draft_version_id = draft.id;
      await ruleRepo.save(rule);
      return rule.id;
    });
    await this.recordActivity(actor, organizationId, projectId, id, 'created');
    return this.get(actor, organizationId, projectId, id);
  }

  async createDraft(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    ruleId: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    await this.dataSource.transaction(async (manager) => {
      const rule = await this.findScoped(
        manager,
        organizationId,
        projectId,
        ruleId,
        true,
      );
      if (rule.archived_at)
        throw new BadRequestException('Archived rules cannot be edited');
      if (rule.draft_version_id) return;
      if (!rule.published_version)
        throw new BadRequestException('Published rule version is unavailable');
      const maxVersion = Math.max(
        0,
        ...rule.versions.map((version) => version.version_number),
      );
      const draft = await manager.getRepository(AutomationRuleVersion).save({
        rule_id: rule.id,
        version_number: maxVersion + 1,
        state: 'draft',
        schema_version: rule.published_version.schema_version,
        definition: rule.published_version.definition,
        created_by_id: actor.userId,
      });
      rule.draft_version_id = draft.id;
      rule.last_material_editor_id = actor.userId;
      await manager.getRepository(AutomationRule).save(rule);
    });
    return this.get(actor, organizationId, projectId, ruleId);
  }

  async updateDraft(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    ruleId: string,
    dto: UpdateAutomationDraftDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    const definition = await this.validateDefinition(
      organizationId,
      projectId,
      dto,
    );
    await this.dataSource.transaction(async (manager) => {
      const rule = await this.findScoped(
        manager,
        organizationId,
        projectId,
        ruleId,
        true,
      );
      if (rule.archived_at)
        throw new BadRequestException('Archived rules cannot be edited');
      if (!rule.draft_version)
        throw new BadRequestException('Create a rule draft first');
      rule.draft_version.definition = definition;
      await manager
        .getRepository(AutomationRuleVersion)
        .save(rule.draft_version);
      if (dto.name !== undefined) rule.name = dto.name.trim();
      if (dto.description !== undefined)
        rule.description = dto.description.trim() || null;
      if (dto.authorizationPolicy !== undefined)
        rule.authorization_policy = dto.authorizationPolicy;
      rule.last_material_editor_id = actor.userId;
      await manager.getRepository(AutomationRule).save(rule);
    });
    await this.recordActivity(
      actor,
      organizationId,
      projectId,
      ruleId,
      'draft_updated',
    );
    return this.get(actor, organizationId, projectId, ruleId);
  }

  async publish(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    ruleId: string,
  ) {
    await this.assertOwner(actor, organizationId, projectId, 'publish');
    await this.dataSource.transaction(async (manager) => {
      const rule = await this.findScoped(
        manager,
        organizationId,
        projectId,
        ruleId,
        true,
      );
      if (rule.archived_at)
        throw new BadRequestException('Archived rules cannot be published');
      if (!rule.draft_version)
        throw new BadRequestException('Rule draft not found');
      await this.validateDefinition(
        organizationId,
        projectId,
        rule.draft_version.definition as unknown as AutomationDefinitionDto,
        manager,
      );
      const versionRepo = manager.getRepository(AutomationRuleVersion);
      if (rule.published_version) {
        rule.published_version.state = 'retired';
        await versionRepo.save(rule.published_version);
      }
      const published = rule.draft_version;
      published.state = 'published';
      published.published_by_id = actor.userId;
      published.published_at = new Date();
      await versionRepo.save(published);
      rule.published_version_id = published.id;
      rule.draft_version_id = null;
      rule.last_material_editor_id = actor.userId;
      await manager.getRepository(AutomationRule).save(rule);
    });
    await this.recordActivity(
      actor,
      organizationId,
      projectId,
      ruleId,
      'published',
    );
    return this.get(actor, organizationId, projectId, ruleId);
  }

  async setEnabled(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    ruleId: string,
    enabled: boolean,
  ) {
    await this.assertOwner(
      actor,
      organizationId,
      projectId,
      enabled ? 'enable' : 'disable',
    );
    const rule = await this.findScoped(
      this.dataSource.manager,
      organizationId,
      projectId,
      ruleId,
    );
    if (rule.archived_at)
      throw new BadRequestException('Archived rules cannot be enabled');
    if (enabled) {
      if (!rule.published_version)
        throw new BadRequestException('Publish the rule before enabling it');
      await this.validateDefinition(
        organizationId,
        projectId,
        rule.published_version.definition as unknown as AutomationDefinitionDto,
      );
      if (!rule.execution_actor?.active)
        throw new BadRequestException('Automation actor is unavailable');
    }
    rule.active = enabled;
    rule.active_since = enabled ? new Date() : null;
    rule.last_material_editor_id = actor.userId;
    await this.dataSource.getRepository(AutomationRule).save(rule);
    await this.recordActivity(
      actor,
      organizationId,
      projectId,
      ruleId,
      enabled ? 'enabled' : 'disabled',
    );
    return this.get(actor, organizationId, projectId, ruleId);
  }

  async archive(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    ruleId: string,
  ) {
    await this.assertOwner(actor, organizationId, projectId, 'archive');
    const rule = await this.findScoped(
      this.dataSource.manager,
      organizationId,
      projectId,
      ruleId,
    );
    if (!rule.archived_at) {
      rule.active = false;
      rule.active_since = null;
      rule.archived_at = new Date();
      rule.last_material_editor_id = actor.userId;
      await this.dataSource.getRepository(AutomationRule).save(rule);
      await this.recordActivity(
        actor,
        organizationId,
        projectId,
        ruleId,
        'archived',
      );
    }
    return { success: true, message: 'Automation rule archived' };
  }

  async dryRun(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    ruleId: string,
    dto: DryRunAutomationDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    const rule = await this.findScoped(
      this.dataSource.manager,
      organizationId,
      projectId,
      ruleId,
    );
    const testVersion = rule.draft_version ?? rule.published_version;
    if (!testVersion)
      throw new BadRequestException('Save the automation before testing it');
    const definition = await this.validateDefinition(
      organizationId,
      projectId,
      testVersion.definition as unknown as AutomationDefinitionDto,
    );
    if (!dto.eventId && !dto.payload)
      throw new BadRequestException(
        'An authorized eventId or synthetic payload is required',
      );
    let source: any;
    if (dto.eventId) {
      source = await this.dataSource.getRepository(AutomationEvent).findOneBy({
        id: dto.eventId,
        organization_id: organizationId,
        project_id: projectId,
      });
      if (!source)
        throw new NotFoundException('Automation sample event not found');
    } else {
      source = this.boundedObject(dto.payload, 0);
    }
    const before = source.before_snapshot ?? source.before ?? {};
    const after = source.after_snapshot ?? source.after ?? source;
    const trace = definition.conditions.slice(0, 20).map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      matched: this.evaluateCondition(condition, before, after),
    }));
    const matched = trace.every((item) => item.matched);
    return {
      success: true,
      data: {
        dryRun: true,
        mutated: false,
        matched,
        conditionTrace: trace,
        actions: definition.actions.slice(0, 20).map((action) => ({
          key: action.key,
          type: action.type,
          outcome: matched ? 'would_run' : 'not_reached',
        })),
      },
    };
  }

  async listRuns(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    query: ListAutomationRunsQueryDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    const where: any = {
      organization_id: organizationId,
      project_id: projectId,
    };
    if (query.ruleId) where.rule_id = query.ruleId;
    if (query.state) where.state = query.state;
    const [runs, total] = await this.dataSource
      .getRepository(AutomationRun)
      .findAndCount({
        where,
        relations: ['rule', 'event', 'action_attempts'],
        order: { created_at: 'DESC' },
        take: query.limit,
        skip: query.offset,
      });
    return {
      success: true,
      data: runs.map((run) => this.serializeRun(run)),
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + runs.length < total,
      },
    };
  }

  async getRun(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    runId: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    const run = await this.dataSource.getRepository(AutomationRun).findOne({
      where: {
        id: runId,
        organization_id: organizationId,
        project_id: projectId,
      },
      relations: ['rule', 'event', 'action_attempts'],
    });
    if (!run) throw new NotFoundException('Automation run not found');
    return { success: true, data: this.serializeRun(run) };
  }

  async retryRun(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    runId: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    const repo = this.dataSource.getRepository(AutomationRun);
    const run = await repo.findOne({
      where: {
        id: runId,
        organization_id: organizationId,
        project_id: projectId,
      },
      relations: ['rule'],
    });
    if (!run) throw new NotFoundException('Automation run not found');
    if (run.state !== 'failed')
      throw new BadRequestException(
        'Only failed automation runs can be retried',
      );
    if (!run.rule?.active || run.rule.archived_at)
      throw new BadRequestException('Enable the automation before retrying');
    await repo.update(run.id, {
      state: 'queued',
      failure_code: null,
      finished_at: null,
    });
    await this.recordActivity(
      actor,
      organizationId,
      projectId,
      run.rule_id,
      'run_retry_requested',
    );
    return { success: true, message: 'Automation run queued for retry' };
  }

  async listWatchers(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    taskId: number,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    const task = await this.dataSource.getRepository(Task).findOne({
      where: {
        id: taskId,
        organization_id: organizationId,
        project: { id: projectId },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    const watchers = await this.dataSource.getRepository(TaskWatcher).find({
      where: { task_id: taskId, organization_id: organizationId },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });
    return {
      success: true,
      data: watchers.map((watcher) => ({
        userId: watcher.user_id,
        name:
          [watcher.user?.first_name, watcher.user?.last_name]
            .filter(Boolean)
            .join(' ') || watcher.user?.email,
        createdAt: watcher.created_at,
      })),
    };
  }

  async removeWatcher(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    taskId: number,
    userId: number,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    await this.dataSource.getRepository(TaskWatcher).delete({
      task_id: taskId,
      user_id: userId,
      organization_id: organizationId,
    });
    return { success: true, message: 'Task watcher removed' };
  }

  private serializeRun(run: AutomationRun) {
    return {
      id: run.id,
      rule: { id: run.rule_id, name: run.rule?.name ?? 'Automation' },
      state: run.state,
      matched: run.matched,
      attemptCount: run.attempt_count,
      conditionTrace: (run.condition_trace ?? []).slice(0, 20),
      failureCode: run.failure_code,
      event: run.event
        ? {
            id: run.event.id,
            type: run.event.event_type,
            subjectType: run.event.subject_type,
            subjectId: run.event.subject_id,
            occurredAt: run.event.occurred_at,
            correlationId: run.event.correlation_id,
          }
        : null,
      actions: (run.action_attempts ?? [])
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
        .slice(0, 50)
        .map((item) => ({
          key: item.action_key,
          state: item.state,
          attempt: item.attempt_number,
          failureCode: item.failure_code,
          startedAt: item.started_at,
          finishedAt: item.finished_at,
        })),
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      createdAt: run.created_at,
    };
  }

  private evaluateCondition(condition: any, before: any, after: any) {
    const value = (snapshot: any) =>
      condition.field.startsWith('custom:')
        ? snapshot?.customFields?.[condition.field.slice(7)] ??
          snapshot?.task?.customFields?.[condition.field.slice(7)]
        : condition.field === 'actor_id'
          ? snapshot?.actorId
          : condition.field === 'project_id'
            ? snapshot?.projectId
            : snapshot?.task?.[condition.field] ?? snapshot?.[condition.field];
    const current = value(after);
    const expected = condition.value;
    const equal = (a: any, b: any) =>
      Array.isArray(a)
        ? a.some((x) => String(x) === String(b))
        : String(a ?? '') === String(b ?? '');
    const compare = (a: any, b: any) => {
      const an = Number(a),
        bn = Number(b);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
      return new Date(a).getTime() - new Date(b).getTime();
    };
    switch (condition.operator) {
      case AutomationConditionOperator.EQUALS:
        return equal(current, expected);
      case AutomationConditionOperator.NOT_EQUALS:
        return !equal(current, expected);
      case AutomationConditionOperator.IN:
        return (
          Array.isArray(expected) && expected.some((x) => equal(current, x))
        );
      case AutomationConditionOperator.NOT_IN:
        return (
          Array.isArray(expected) && !expected.some((x) => equal(current, x))
        );
      case AutomationConditionOperator.IS_SET:
        return current !== undefined && current !== null && current !== '';
      case AutomationConditionOperator.IS_NOT_SET:
        return current === undefined || current === null || current === '';
      case AutomationConditionOperator.GREATER_THAN:
        return compare(current, expected) > 0;
      case AutomationConditionOperator.GREATER_THAN_OR_EQUAL:
        return compare(current, expected) >= 0;
      case AutomationConditionOperator.LESS_THAN:
        return compare(current, expected) < 0;
      case AutomationConditionOperator.LESS_THAN_OR_EQUAL:
        return compare(current, expected) <= 0;
      case AutomationConditionOperator.CHANGED_FROM:
        return equal(value(before), expected);
      case AutomationConditionOperator.CHANGED_TO:
        return equal(current, expected);
      default:
        return false;
    }
  }

  private boundedObject(value: unknown, depth: number): any {
    if (depth > 5) return '[truncated]';
    if (typeof value === 'string') return value.slice(0, 1000);
    if (Array.isArray(value))
      return value
        .slice(0, 50)
        .map((item) => this.boundedObject(item, depth + 1));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .slice(0, 100)
          .filter(
            ([key]) =>
              !/(password|token|secret|authorization|cookie)/i.test(key),
          )
          .map(([key, item]) => [key, this.boundedObject(item, depth + 1)]),
      );
    return value;
  }

  private async validateDefinition(
    organizationId: string,
    projectId: number,
    dto: AutomationDefinitionDto,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<AutomationRuleDefinition> {
    if (!dto?.trigger || !Array.isArray(dto.conditions) || !dto.actions?.length)
      throw new BadRequestException(
        'A trigger, conditions array, and at least one action are required',
      );
    const actionKeys = dto.actions.map((action) => action.key);
    if (new Set(actionKeys).size !== actionKeys.length)
      throw new BadRequestException('Action keys must be unique');

    const statusIds = new Set<number>();
    const customFieldIds = new Set<string>();
    const memberIds = new Set<number>();
    const templateIds = new Set<string>();
    const formIds = new Set<string>();

    this.validateTrigger(dto.trigger, formIds, customFieldIds);
    for (const condition of dto.conditions) {
      if (
        !(
          dto.trigger.type === AutomationTriggerType.TASK_INGESTED &&
          (AUTOMATION_INGESTION_FIELDS as readonly string[]).includes(
            condition.field,
          )
        )
      )
        this.validateFieldReference(condition.field, customFieldIds);
      if (
        NO_VALUE_CONDITION_OPERATORS.has(condition.operator) &&
        condition.value !== undefined
      )
        throw new BadRequestException(
          `${condition.operator} conditions cannot include a value`,
        );
      if (
        !NO_VALUE_CONDITION_OPERATORS.has(condition.operator) &&
        condition.value === undefined
      )
        throw new BadRequestException(
          `${condition.operator} conditions require a value`,
        );
      if (
        CHANGE_CONDITION_OPERATORS.has(condition.operator) &&
        ![
          AutomationTriggerType.TASK_FIELD_CHANGED,
          AutomationTriggerType.TASK_STATUS_CHANGED,
        ].includes(dto.trigger.type)
      )
        throw new BadRequestException(
          `${condition.operator} requires a change trigger`,
        );
      if (
        [
          AutomationConditionOperator.IN,
          AutomationConditionOperator.NOT_IN,
        ].includes(condition.operator) &&
        !Array.isArray(condition.value)
      )
        throw new BadRequestException(
          `${condition.operator} conditions require an array value`,
        );
      if (condition.value !== undefined)
        this.collectConditionResources(
          condition.field,
          condition.value,
          statusIds,
          memberIds,
          projectId,
        );
    }
    for (const action of dto.actions)
      this.validateAction(
        action.type,
        action.config,
        statusIds,
        customFieldIds,
        memberIds,
        templateIds,
      );

    if (statusIds.size) {
      const count = await manager.getRepository(Status).count({
        where: {
          id: In([...statusIds]),
          project: { id: projectId },
          isActive: true,
        },
      });
      if (count !== statusIds.size)
        throw new BadRequestException('A referenced status is unavailable');
    }
    if (customFieldIds.size) {
      const count = await manager.getRepository(CustomFieldDefinition).count({
        where: {
          id: In([...customFieldIds]),
          organization_id: organizationId,
          project_id: projectId,
          archived_at: IsNull(),
        },
      });
      if (count !== customFieldIds.size)
        throw new BadRequestException(
          'A referenced custom field is unavailable',
        );
    }
    if (memberIds.size)
      await this.validateMembers(manager, organizationId, projectId, memberIds);
    if (templateIds.size) {
      const templates = await manager.getRepository(ReusableTemplate).find({
        where: {
          id: In([...templateIds]),
          organization_id: organizationId,
          archived_at: IsNull(),
        },
      });
      if (
        templates.length !== templateIds.size ||
        templates.some(
          (template) => template.type !== ReusableTemplateType.TASK,
        )
      )
        throw new BadRequestException(
          'A referenced task template is unavailable',
        );
    }
    if (formIds.size) {
      const forms = await manager.getRepository(RequestForm).find({
        where: {
          id: In([...formIds]),
          organization_id: organizationId,
          project_id: projectId,
          archived_at: IsNull(),
        },
        relations: ['versions'],
      });
      if (
        forms.length !== formIds.size ||
        forms.some(
          (form) =>
            !form.versions.some((version) => version.state === 'published'),
        )
      )
        throw new BadRequestException(
          'A referenced form is unavailable or unpublished',
        );
    }
    return JSON.parse(
      JSON.stringify({
        trigger: dto.trigger,
        conditions: dto.conditions,
        actions: dto.actions,
      }),
    ) as AutomationRuleDefinition;
  }

  private validateTrigger(
    trigger: AutomationDefinitionDto['trigger'],
    formIds: Set<string>,
    customFieldIds: Set<string>,
  ) {
    const config = trigger.config ?? {};
    if (trigger.type === AutomationTriggerType.TASK_FIELD_CHANGED) {
      this.assertKeys(config, ['field']);
      this.validateFieldReference(
        this.stringValue(config, 'field'),
        customFieldIds,
      );
    } else if (trigger.type === AutomationTriggerType.FORM_SUBMITTED) {
      this.assertKeys(config, ['formId']);
      formIds.add(this.uuidValue(config, 'formId'));
    } else {
      this.assertKeys(config, []);
    }
  }

  private collectConditionResources(
    field: string,
    value: unknown,
    statusIds: Set<number>,
    memberIds: Set<number>,
    projectId: number,
  ) {
    const values = Array.isArray(value) ? value : [value];
    if (field === 'status_id') {
      values.forEach((item) => {
        if (!Number.isInteger(item) || Number(item) < 1)
          throw new BadRequestException('Status conditions require status IDs');
        statusIds.add(Number(item));
      });
    }
    if (field === 'assignee_ids' || field === 'actor_id') {
      values.forEach((item) => {
        if (!Number.isInteger(item) || Number(item) < 1)
          throw new BadRequestException('Member conditions require member IDs');
        memberIds.add(Number(item));
      });
    }
    if (
      field === 'project_id' &&
      values.some((item) => Number(item) !== projectId)
    )
      throw new BadRequestException(
        'Automation conditions cannot reference another project',
      );
  }

  private validateAction(
    type: AutomationActionType,
    config: Record<string, unknown>,
    statusIds: Set<number>,
    customFieldIds: Set<string>,
    memberIds: Set<number>,
    templateIds: Set<string>,
  ) {
    if (type === AutomationActionType.ASSIGN) {
      this.assertKeys(config, ['memberId']);
      memberIds.add(this.intValue(config, 'memberId'));
    } else if (type === AutomationActionType.UPDATE_FIELD) {
      this.assertKeys(config, ['field', 'value']);
      const field = this.stringValue(config, 'field');
      this.validateFieldReference(field, customFieldIds);
      if (config.value === undefined)
        throw new BadRequestException('Update field action requires a value');
    } else if (type === AutomationActionType.TRANSITION_STATUS) {
      this.assertKeys(config, ['statusId']);
      statusIds.add(this.intValue(config, 'statusId'));
    } else if (type === AutomationActionType.ADD_WATCHER) {
      this.assertKeys(config, ['memberId']);
      memberIds.add(this.intValue(config, 'memberId'));
    } else if (type === AutomationActionType.NOTIFY) {
      this.assertKeys(config, ['recipientMemberIds', 'message']);
      const ids = config.recipientMemberIds;
      if (!Array.isArray(ids) || !ids.length || ids.length > 50)
        throw new BadRequestException(
          'Notify action requires 1 to 50 recipient member IDs',
        );
      ids.forEach((id) => {
        if (!Number.isInteger(id) || Number(id) < 1)
          throw new BadRequestException('Recipient member IDs are invalid');
        memberIds.add(Number(id));
      });
      if (
        config.message !== undefined &&
        (typeof config.message !== 'string' || config.message.length > 500)
      )
        throw new BadRequestException(
          'Notification message must not exceed 500 characters',
        );
    } else if (type === AutomationActionType.CREATE_TASK_FROM_TEMPLATE) {
      this.assertKeys(config, ['templateId']);
      templateIds.add(this.uuidValue(config, 'templateId'));
    }
  }

  private validateFieldReference(field: string, customIds: Set<string>) {
    if ((AUTOMATION_STANDARD_FIELDS as readonly string[]).includes(field))
      return;
    if (field.startsWith('custom:')) {
      const id = field.slice(7);
      if (!this.isUuid(id))
        throw new BadRequestException('Custom field reference is invalid');
      customIds.add(id);
      return;
    }
    if (['actor_id', 'project_id'].includes(field)) return;
    throw new BadRequestException(`Unsupported automation field: ${field}`);
  }

  private async validateMembers(
    manager: EntityManager,
    organizationId: string,
    projectId: number,
    memberIds: Set<number>,
  ) {
    const project = await manager.getRepository(Project).findOne({
      where: { id: projectId, organization_id: organizationId },
      relations: ['user'],
    });
    if (!project) throw new NotFoundException('Project not found');
    const valid = new Set<number>();
    if (project.user?.id) valid.add(Number(project.user.id));
    const peers = await manager.getRepository(ProjectPeer).find({
      where: {
        project: { id: projectId },
        organization_id: organizationId,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
      relations: ['user'],
    });
    peers.forEach((peer) => valid.add(Number(peer.user.id)));
    if ([...memberIds].some((id) => !valid.has(id)))
      throw new BadRequestException(
        'A referenced project member is unavailable',
      );
  }

  private async ensureAutomationActor(
    manager: EntityManager,
    organizationId: string,
  ) {
    const repo = manager.getRepository(AutomationActor);
    let automationActor = await repo.findOne({
      where: {
        organization_id: organizationId,
        stable_key: 'tailpoint_automation',
      },
    });
    if (!automationActor) {
      await repo
        .createQueryBuilder()
        .insert()
        .values({
          id: randomUUID(),
          organization_id: organizationId,
          stable_key: 'tailpoint_automation',
          display_name: 'Tailpoint Automation',
          active: true,
        })
        .orIgnore()
        .execute();
      automationActor = await repo.findOne({
        where: {
          organization_id: organizationId,
          stable_key: 'tailpoint_automation',
        },
      });
    }
    if (!automationActor)
      throw new BadRequestException('Unable to provision automation actor');
    return automationActor;
  }

  private async findScoped(
    manager: EntityManager,
    organizationId: string,
    projectId: number,
    ruleId: string,
    lock = false,
  ) {
    const rule = await manager.getRepository(AutomationRule).findOne({
      where: {
        id: ruleId,
        organization_id: organizationId,
        project_id: projectId,
      },
      relations: [
        'execution_actor',
        'published_version',
        'draft_version',
        'versions',
      ],
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!rule) throw new NotFoundException('Automation rule not found');
    return rule;
  }

  private async assertOwner(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    action: string,
  ) {
    const context = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.MANAGE_SETTINGS,
    );
    if (context.role !== ProjectRole.OWNER && actor.role !== 'super_admin')
      throw new ForbiddenException(
        `Only project owners can ${action} automation rules`,
      );
  }

  private canEdit(role: ProjectRole, actor: AuthUser) {
    return (
      actor.role === 'super_admin' ||
      role === ProjectRole.EDITOR ||
      role === ProjectRole.OWNER
    );
  }

  private serialize(rule: AutomationRule, includeDefinition: boolean) {
    const version = (item: AutomationRuleVersion | null | undefined) =>
      item
        ? {
            id: item.id,
            version: item.version_number,
            state: item.state,
            schemaVersion: item.schema_version,
            ...(includeDefinition ? { definition: item.definition } : {}),
            publishedAt: item.published_at,
            createdAt: item.created_at,
          }
        : null;
    return {
      id: rule.id,
      key: rule.stable_key,
      name: rule.name,
      description: rule.description,
      active: rule.active,
      activeSince: rule.active_since,
      authorizationPolicy: rule.authorization_policy,
      archivedAt: rule.archived_at,
      published: version(rule.published_version),
      ...(includeDefinition ? { draft: version(rule.draft_version) } : {}),
      createdById: rule.created_by_id,
      lastMaterialEditorId: rule.last_material_editor_id,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    };
  }

  private async recordActivity(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    ruleId: string,
    action: string,
  ) {
    await this.dataSource.getRepository(ProjectActivity).save({
      projectId,
      project: { id: projectId } as Project,
      userId: actor.userId,
      user: { id: actor.userId } as User,
      activityType: ActivityType.PROJECT_UPDATED,
      description: `Automation rule ${action}`,
      entityType: 'automation_rule',
      entityId: null,
      organization_id: organizationId,
      metadata: { ruleId, action },
    });
  }

  private assertKeys(config: Record<string, unknown>, allowed: string[]) {
    const unexpected = Object.keys(config).filter(
      (key) => !allowed.includes(key),
    );
    if (unexpected.length)
      throw new BadRequestException(
        `Unsupported configuration keys: ${unexpected.join(', ')}`,
      );
  }

  private stringValue(config: Record<string, unknown>, key: string) {
    const value = config[key];
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${key} must be a non-empty string`);
    return value;
  }

  private intValue(config: Record<string, unknown>, key: string) {
    const value = config[key];
    if (!Number.isInteger(value) || Number(value) < 1)
      throw new BadRequestException(`${key} must be a positive integer`);
    return Number(value);
  }

  private uuidValue(config: Record<string, unknown>, key: string) {
    const value = this.stringValue(config, key);
    if (!this.isUuid(value))
      throw new BadRequestException(`${key} must be a UUID`);
    return value;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
