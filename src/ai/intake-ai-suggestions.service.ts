import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import {
  IntakeAiProposedChanges,
  IntakeAiSuggestion,
} from 'src/typeorm/entities/IntakeAiSuggestion';
import { IntakeEvent } from 'src/typeorm/entities/IntakeEvent';
import { AuthUser } from 'src/types/users';
import { DataSource, Repository } from 'typeorm';
import { AiAssistanceService } from './ai-assistance.service';
import { AiGovernanceService } from './ai-governance.service';
import {
  AiIntakeMatchingContext,
  AiIntakeMatchingContextService,
} from './ai-intake-matching-context.service';
import { ApplyIntakeSuggestionDto } from './dto/apply-intake-suggestion.dto';
import { Task } from 'src/typeorm/entities/Task';
import { Project } from 'src/typeorm/entities/Project';
import { Category } from 'src/typeorm/entities/Category';
import { User } from 'src/typeorm/entities/User';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { AuditLog } from 'src/typeorm/entities/AuditLog';

type PendingSuggestion = {
  eventId: string;
  proposedChanges: IntakeAiProposedChanges;
  reasons: Record<string, string>;
  confidence: Record<string, number>;
  correlationId: string;
  templateId: string;
  templateVersion: number;
};

@Injectable()
export class IntakeAiSuggestionsService {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly entitlements: EntitlementsService,
    private readonly ai: AiAssistanceService,
    private readonly governance: AiGovernanceService,
    private readonly matchingContext: AiIntakeMatchingContextService,
    private readonly dataSource: DataSource,
    @InjectRepository(IntakeEvent)
    private readonly events: Repository<IntakeEvent>,
    @InjectRepository(IntakeAiSuggestion)
    private readonly suggestions: Repository<IntakeAiSuggestion>,
    @InjectRepository(AuditLog)
    private readonly audits: Repository<AuditLog>,
  ) {}

  async generate(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    eventId: string,
  ) {
    await this.assertAccess(actor, organizationId, projectId, ProjectPermission.EDIT);
    const event = await this.findEvent(organizationId, projectId, eventId);
    const matching = await this.matchingContext.assemble(
      actor,
      organizationId,
      projectId,
      typeof event.normalized_payload?.title === 'string'
        ? event.normalized_payload.title
        : '',
      event.task_id,
    );
    const input = this.boundedInput(event, matching);
    const result = await this.ai.assist(actor, organizationId, {
      featureId: 'suggest_intake',
      input: JSON.stringify(input),
    });
    let parsed: ReturnType<IntakeAiSuggestionsService['parseGeneratedContract']>;
    try {
      parsed = this.parseGeneratedContract(result.draft, matching);
    } catch (error) {
      await this.governance
        .markPostprocessingFailure(
          organizationId,
          result.correlationId,
          'invalid_structured_output',
        )
        .catch(() => undefined);
      throw error;
    }
    if (!Object.keys(parsed.changes).length)
      return {
        suggestion: null,
        noChanges: true,
        correlationId: result.correlationId,
        requiresReview: false,
      };
    return this.createPending(actor, organizationId, projectId, {
      eventId,
      proposedChanges: parsed.changes,
      reasons: parsed.reasons,
      confidence: parsed.confidence,
      correlationId: result.correlationId,
      templateId: 'suggest_intake',
      templateVersion: 2,
    });
  }

  async createPending(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    input: PendingSuggestion,
  ) {
    await this.assertAccess(actor, organizationId, projectId, ProjectPermission.EDIT);
    const event = await this.findEvent(organizationId, projectId, input.eventId);
    this.validateContract(input.proposedChanges, input.reasons, input.confidence);
    return this.suggestions.save(
      this.suggestions.create({
        organization_id: organizationId,
        project_id: projectId,
        event_id: event.id,
        state: 'pending',
        payload_fingerprint: this.fingerprint(event.normalized_payload),
        proposed_changes: input.proposedChanges,
        reasons: input.reasons,
        confidence: input.confidence,
        correlation_id: input.correlationId,
        template_id: input.templateId,
        template_version: input.templateVersion,
        created_by_id: actor.userId,
        reviewed_by_id: null,
        reviewed_at: null,
        review_note: null,
        contract_version: 1,
      }),
    );
  }

  async listForEvent(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    eventId: string,
  ) {
    await this.assertAccess(actor, organizationId, projectId, ProjectPermission.VIEW);
    await this.findEvent(organizationId, projectId, eventId);
    return this.suggestions.find({
      where: { organization_id: organizationId, project_id: projectId, event_id: eventId },
      order: { created_at: 'DESC' },
    });
  }

  async dismiss(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    suggestionId: string,
    note?: string,
  ) {
    await this.assertAccess(actor, organizationId, projectId, ProjectPermission.EDIT);
    const suggestion = await this.suggestions.findOne({
      where: { id: suggestionId, organization_id: organizationId, project_id: projectId },
    });
    if (!suggestion) throw new NotFoundException('AI intake suggestion not found');
    if (suggestion.state === 'dismissed') return suggestion;
    if (suggestion.state !== 'pending')
      throw new ConflictException(`Suggestion is already ${suggestion.state}`);
    const result = await this.suggestions.update(
      { id: suggestion.id, state: 'pending' },
      {
        state: 'dismissed',
        reviewed_by_id: actor.userId,
        reviewed_at: new Date(),
        review_note: note?.trim() || null,
      },
    );
    if (!result.affected)
      throw new ConflictException('Suggestion was reviewed concurrently');
    await this.audits.save(
      this.audits.create({
        action: 'AI_INTAKE_SUGGESTION_DISMISSED',
        admin_id: actor.userId,
        target_user_id: null,
        organization_id: organizationId,
        metadata: {
          project_id: projectId,
          event_id: suggestion.event_id,
          suggestion_id: suggestion.id,
        },
      }),
    );
    return this.suggestions.findOneOrFail({ where: { id: suggestion.id } });
  }

  async apply(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    suggestionId: string,
    dto: ApplyIntakeSuggestionDto,
  ) {
    await this.assertAccess(actor, organizationId, projectId, ProjectPermission.EDIT);
    const suggestion = await this.suggestions.findOne({
      where: { id: suggestionId, organization_id: organizationId, project_id: projectId },
    });
    if (!suggestion) throw new NotFoundException('AI intake suggestion not found');
    if (suggestion.state !== 'pending')
      throw new ConflictException(`Suggestion is already ${suggestion.state}`);
    const fields = [...new Set(dto.fields)];
    if (fields.some((field) => suggestion.proposed_changes[field] === undefined))
      throw new BadRequestException('Selected field is not part of this suggestion');
    if (
      fields.includes('duplicateTaskId') &&
      fields.some((field) => !['duplicateTaskId', 'title', 'priority'].includes(field))
    )
      throw new BadRequestException(
        'Duplicate merge may only include the selected title and priority changes',
      );
    if (fields.includes('duplicateTaskId') && !dto.confirmDuplicateMerge)
      throw new BadRequestException('Duplicate merge confirmation is required');
    if (fields.includes('destinationProjectId') && !dto.confirmRouting)
      throw new BadRequestException('Routing confirmation is required');

    const event = await this.findEvent(organizationId, projectId, suggestion.event_id);
    if (this.fingerprint(event.normalized_payload) !== suggestion.payload_fingerprint) {
      await this.suggestions.update(
        { id: suggestion.id, state: 'pending' },
        {
          state: 'stale',
          reviewed_by_id: actor.userId,
          reviewed_at: new Date(),
          review_note: 'Source intake payload changed before review',
        },
      );
      throw new ConflictException('Suggestion is stale because the intake payload changed');
    }
    const destinationId = fields.includes('destinationProjectId')
      ? suggestion.proposed_changes.destinationProjectId!
      : projectId;
    if (destinationId !== projectId)
      await this.authorization.assertProjectPermission(
        actor,
        organizationId,
        destinationId,
        ProjectPermission.EDIT,
      );
    if (fields.includes('duplicateTaskId')) {
      const duplicate = await this.dataSource.getRepository(Task).findOne({
        where: { id: suggestion.proposed_changes.duplicateTaskId, organization_id: organizationId },
        relations: ['project'],
      });
      if (!duplicate) throw new NotFoundException('Duplicate task candidate not found');
      await this.authorization.assertProjectPermission(
        actor,
        organizationId,
        Number(duplicate.project.id),
        ProjectPermission.VIEW,
      );
    }

    const outcome = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.getRepository(IntakeAiSuggestion).findOne({
        where: { id: suggestion.id, organization_id: organizationId, project_id: projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.state !== 'pending') return { concurrent: true } as const;
      const currentEvent = await manager.getRepository(IntakeEvent).findOne({
        where: { id: locked.event_id, organization_id: organizationId, project_id: projectId },
      });
      if (!currentEvent?.task_id)
        throw new ConflictException('Intake event has no task to update');
      if (this.fingerprint(currentEvent.normalized_payload) !== locked.payload_fingerprint) {
        Object.assign(locked, {
          state: 'stale',
          reviewed_by_id: actor.userId,
          reviewed_at: new Date(),
          review_note: 'Source intake payload changed before review',
        });
        await manager.save(locked);
        return { stale: true } as const;
      }
      const taskRepo = manager.getRepository(Task);
      const task = await taskRepo.findOne({
        where: { id: currentEvent.task_id, organization_id: organizationId },
        relations: ['project', 'status', 'assignees', 'categories'],
      });
      if (!task) throw new NotFoundException('Intake task not found');

      if (fields.includes('duplicateTaskId')) {
        const duplicate = await taskRepo.findOne({
          where: { id: locked.proposed_changes.duplicateTaskId, organization_id: organizationId },
          relations: ['project'],
        });
        if (!duplicate || Number(duplicate.id) === Number(task.id))
          throw new BadRequestException('Duplicate task candidate is invalid');
        if (fields.includes('title')) duplicate.title = locked.proposed_changes.title!;
        if (fields.includes('priority'))
          duplicate.priority = locked.proposed_changes.priority!;
        if (fields.includes('title') || fields.includes('priority'))
          await taskRepo.save(duplicate);
        currentEvent.task_id = duplicate.id;
        await manager.save(currentEvent);
        await taskRepo.delete(task.id);
      } else {
        let targetProject = task.project;
        if (fields.includes('destinationProjectId')) {
          const project = await manager.getRepository(Project).findOne({
            where: { id: destinationId, organization_id: organizationId },
            relations: ['defaultIngestionStatus'],
          });
          if (!project?.defaultIngestionStatus)
            throw new BadRequestException('Destination project has no default intake status');
          targetProject = project;
          task.project = project;
          task.status = project.defaultIngestionStatus;
        }
        if (fields.includes('title')) task.title = locked.proposed_changes.title!;
        if (fields.includes('priority')) task.priority = locked.proposed_changes.priority!;
        if (fields.includes('category')) {
          const category = await manager.getRepository(Category).findOne({
            where: {
              name: locked.proposed_changes.category,
              organization_id: organizationId,
              projects: { id: targetProject.id },
            },
          });
          if (!category)
            throw new BadRequestException('Suggested category is not available in the target project');
          task.categories = [category];
        }
        if (fields.includes('assigneeId')) {
          const assigneeId = locked.proposed_changes.assigneeId!;
          const target = await manager.getRepository(Project).findOne({
            where: { id: targetProject.id, organization_id: organizationId },
            relations: ['user'],
          });
          const isOwner = Number(target?.user?.id) === Number(assigneeId);
          const isMember = isOwner
            ? true
            : await manager.getRepository(ProjectPeer).exists({
                where: {
                  project: { id: targetProject.id },
                  user: { id: assigneeId },
                  organization_id: organizationId,
                  status: ProjectPeerStatus.CONNECTED,
                  is_confirmed: true,
                },
              });
          if (!isMember)
            throw new BadRequestException('Suggested assignee is no longer a project member');
          const user = await manager.getRepository(User).findOneBy({ id: assigneeId });
          if (!user) throw new NotFoundException('Suggested assignee not found');
          task.assignees = [user];
        }
        await taskRepo.save(task);
      }
      Object.assign(locked, {
        state: 'applied',
        reviewed_by_id: actor.userId,
        reviewed_at: new Date(),
        review_note: `Applied fields: ${fields.join(', ')}`,
      });
      await manager.save(locked);
      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create({
          action: 'AI_INTAKE_SUGGESTION_APPLIED',
          admin_id: actor.userId,
          target_user_id: null,
          organization_id: organizationId,
          metadata: {
            project_id: projectId,
            event_id: locked.event_id,
            suggestion_id: locked.id,
            fields,
          },
        }),
      );
      return { applied: true, fields, taskId: currentEvent.task_id } as const;
    });
    if ('concurrent' in outcome)
      throw new ConflictException('Suggestion was reviewed concurrently');
    if ('stale' in outcome)
      throw new ConflictException('Suggestion is stale because the intake payload changed');
    return outcome;
  }

  private async assertAccess(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    permission: ProjectPermission,
  ) {
    await Promise.all([
      this.entitlements.assertCapability(actor, organizationId, CapabilityKey.AI_ASSISTANCE),
      this.entitlements.assertCapability(actor, organizationId, CapabilityKey.UNIVERSAL_INTAKE),
      this.authorization.assertProjectPermission(actor, organizationId, projectId, permission),
    ]);
  }

  private async findEvent(organizationId: string, projectId: number, eventId: string) {
    const event = await this.events.findOne({
      where: { id: eventId, organization_id: organizationId, project_id: projectId },
    });
    if (!event) throw new NotFoundException('Intake event not found');
    return event;
  }

  private validateContract(
    changes: IntakeAiProposedChanges,
    reasons: Record<string, string>,
    confidence: Record<string, number>,
  ) {
    const allowed = new Set([
      'title',
      'category',
      'priority',
      'duplicateTaskId',
      'assigneeId',
      'destinationProjectId',
    ]);
    const keys = Object.keys(changes);
    if (!keys.length || keys.some((key) => !allowed.has(key)))
      throw new BadRequestException('AI intake suggestion has unsupported changes');
    if (
      (changes.title !== undefined &&
        (typeof changes.title !== 'string' || !changes.title.trim() || changes.title.length > 255)) ||
      (changes.category !== undefined &&
        (typeof changes.category !== 'string' || !changes.category.trim() || changes.category.length > 100)) ||
      (changes.priority !== undefined &&
        (!Number.isInteger(changes.priority) || changes.priority < 0)) ||
      (changes.duplicateTaskId !== undefined &&
        (!Number.isInteger(changes.duplicateTaskId) || changes.duplicateTaskId < 1)) ||
      (changes.assigneeId !== undefined &&
        (!Number.isInteger(changes.assigneeId) || changes.assigneeId < 1)) ||
      (changes.destinationProjectId !== undefined &&
        (!Number.isInteger(changes.destinationProjectId) || changes.destinationProjectId < 1))
    )
      throw new BadRequestException('AI intake suggestion has invalid change values');
    if (
      Object.keys(reasons).some((key) => !keys.includes(key)) ||
      Object.keys(confidence).some((key) => !keys.includes(key))
    )
      throw new BadRequestException('AI intake suggestion metadata has unsupported fields');
    for (const key of keys) {
      if (
        typeof reasons[key] !== 'string' ||
        !reasons[key].trim() ||
        reasons[key].length > 500
      )
        throw new BadRequestException(`A reason is required for ${key}`);
      if (!Number.isFinite(confidence[key]) || confidence[key] < 0 || confidence[key] > 1)
        throw new BadRequestException(`Confidence for ${key} must be between 0 and 1`);
    }
  }

  private boundedInput(event: IntakeEvent, matching: AiIntakeMatchingContext) {
    const payload = event.normalized_payload ?? {};
    const text = (key: string, limit: number) =>
      typeof payload[key] === 'string'
        ? String(payload[key]).trim().slice(0, limit)
        : undefined;
    return {
      channel: event.channel,
      title: text('title', 500),
      description: text('description', 10_000),
      severity: text('severity', 40),
      priority:
        typeof payload.priority === 'number' ? payload.priority : undefined,
      candidates: {
        projects: matching.projects,
        duplicateTasks: matching.duplicateTasks,
        categories: matching.categories,
      },
    };
  }

  private parseGeneratedContract(
    value: string,
    matching: AiIntakeMatchingContext,
  ): {
    changes: IntakeAiProposedChanges;
    reasons: Record<string, string>;
    confidence: Record<string, number>;
  } {
    const source = value
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    let parsed: any;
    try {
      parsed = JSON.parse(source);
    } catch {
      parsed = this.repairValueKeyedMetadata(source);
      if (!parsed)
        throw new BadRequestException('AI returned an invalid suggestion format');
    }
    const topLevel = Object.keys(parsed ?? {});
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      topLevel.some((key) => !['changes', 'reasons', 'confidence'].includes(key)) ||
      !parsed.changes ||
      typeof parsed.changes !== 'object' ||
      !parsed.reasons ||
      typeof parsed.reasons !== 'object' ||
      !parsed.confidence ||
      typeof parsed.confidence !== 'object'
    )
      throw new BadRequestException('AI returned an invalid suggestion contract');
    const changes = Object.fromEntries(
      Object.entries(parsed.changes as Record<string, unknown>).filter(
        ([, value]) => value !== null && value !== undefined,
      ),
    );
    const numericFields = [
      'priority',
      'duplicateTaskId',
      'assigneeId',
      'destinationProjectId',
    ];
    for (const key of numericFields) {
      const value = changes[key];
      if (typeof value === 'string' && /^\d+$/.test(value.trim()))
        changes[key] = Number(value.trim());
    }
    let keys = Object.keys(changes);
    const supported = [
      'title',
      'category',
      'priority',
      'duplicateTaskId',
      'assigneeId',
      'destinationProjectId',
    ];
    const unsupported = keys.filter((key) => !supported.includes(key));
    if (unsupported.length)
      throw new BadRequestException(
        `AI returned unsupported intake changes: ${unsupported.join(', ')}`,
      );
    if (!keys.length) return { changes: {}, reasons: {}, confidence: {} };
    const invalidFields = [
      ...(changes.title !== undefined &&
      (typeof changes.title !== 'string' || !changes.title.trim() || changes.title.length > 255)
        ? ['title']
        : []),
      ...(changes.category !== undefined &&
      (typeof changes.category !== 'string' || !changes.category.trim() || changes.category.length > 100)
        ? ['category']
        : []),
      ...(changes.priority !== undefined &&
      (!Number.isInteger(changes.priority) || Number(changes.priority) < 0)
        ? ['priority']
        : []),
    ];
    for (const key of invalidFields) delete changes[key];
    keys = Object.keys(changes);
    if (!keys.length) return { changes: {}, reasons: {}, confidence: {} };
    const projectIds = new Set(matching.projects.map((project) => project.id));
    const duplicateIds = new Set(matching.duplicateTasks.map((task) => task.id));
    if (
      changes.category !== undefined &&
      !matching.categories.includes(String(changes.category).trim())
    ) {
      delete changes.category;
      keys = Object.keys(changes);
      if (!keys.length) return { changes: {}, reasons: {}, confidence: {} };
    }
    if (
      changes.destinationProjectId !== undefined &&
      (!Number.isInteger(changes.destinationProjectId) ||
        !projectIds.has(Number(changes.destinationProjectId)))
    )
      throw new BadRequestException('AI returned an unauthorized destination project');
    if (
      changes.duplicateTaskId !== undefined &&
      (!Number.isInteger(changes.duplicateTaskId) ||
        !duplicateIds.has(Number(changes.duplicateTaskId)))
    )
      throw new BadRequestException('AI returned an unauthorized duplicate task');
    const assigneeProjectId =
      changes.destinationProjectId === undefined
        ? matching.sourceProjectId
        : Number(changes.destinationProjectId);
    const allowedAssignees = new Set(
      matching.projects
        .find((project) => project.id === assigneeProjectId)
        ?.members.map((member) => member.id) ?? [],
    );
    if (
      changes.assigneeId !== undefined &&
      (!Number.isInteger(changes.assigneeId) ||
        !allowedAssignees.has(Number(changes.assigneeId)))
    )
      throw new BadRequestException('AI returned an unauthorized assignee');
    const normalized: IntakeAiProposedChanges = {
      ...(typeof changes.title === 'string' ? { title: changes.title.trim() } : {}),
      ...(typeof changes.category === 'string' ? { category: changes.category.trim() } : {}),
      ...(typeof changes.priority === 'number' ? { priority: changes.priority } : {}),
      ...(typeof changes.duplicateTaskId === 'number'
        ? { duplicateTaskId: changes.duplicateTaskId }
        : {}),
      ...(typeof changes.assigneeId === 'number'
        ? { assigneeId: changes.assigneeId }
        : {}),
      ...(typeof changes.destinationProjectId === 'number'
        ? { destinationProjectId: changes.destinationProjectId }
        : {}),
    };
    const reasons = Object.fromEntries(
      Object.entries(parsed.reasons).filter(([key]) => keys.includes(key)),
    ) as Record<string, string>;
    const confidence = Object.fromEntries(
      Object.entries(parsed.confidence)
        .filter(([key]) => keys.includes(key))
        .map(([key, value]) => [
          key,
          typeof value === 'string' && /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(value.trim())
            ? Number(value.trim())
            : value,
        ]),
    ) as Record<string, number>;
    for (const key of Object.keys(normalized)) {
      if (
        typeof reasons[key] !== 'string' ||
        !reasons[key].trim() ||
        reasons[key].length > 500 ||
        !Number.isFinite(confidence[key]) ||
        confidence[key] < 0 ||
        confidence[key] > 1
      ) {
        delete normalized[key as keyof IntakeAiProposedChanges];
        delete reasons[key];
        delete confidence[key];
      }
    }
    if (!Object.keys(normalized).length)
      return { changes: {}, reasons: {}, confidence: {} };
    this.validateContract(normalized, reasons, confidence);
    return { changes: normalized, reasons, confidence };
  }

  private fingerprint(payload: Record<string, unknown>) {
    return createHash('sha256').update(this.stableJson(payload)).digest('hex');
  }

  private repairValueKeyedMetadata(source: string) {
    try {
      const changesSource = this.extractObject(source, 'changes');
      const reasonsSource = this.extractObject(source, 'reasons');
      const confidenceSource = this.extractObject(source, 'confidence');
      if (!changesSource || !reasonsSource || !confidenceSource) return null;
      const changes = JSON.parse(changesSource) as Record<string, unknown>;
      const repair = (objectSource: string) => {
        let repaired = objectSource;
        for (const [key, value] of Object.entries(changes)) {
          const field = this.escapeRegExp(JSON.stringify(key));
          const proposedValue = this.escapeRegExp(JSON.stringify(value));
          repaired = repaired.replace(
            new RegExp(`(${field}\\s*:)\\s*${proposedValue}\\s*:`),
            '$1',
          );
        }
        return JSON.parse(repaired);
      };
      return {
        changes,
        reasons: repair(reasonsSource),
        confidence: repair(confidenceSource),
      };
    } catch {
      return null;
    }
  }

  private extractObject(source: string, key: string) {
    const match = new RegExp(`${this.escapeRegExp(JSON.stringify(key))}\\s*:`).exec(source);
    if (!match) return null;
    const start = source.indexOf('{', match.index + match[0].length);
    if (start < 0) return null;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (quoted && character === '\\') {
        escaped = true;
        continue;
      }
      if (character === '"') quoted = !quoted;
      if (quoted) continue;
      if (character === '{') depth += 1;
      if (character === '}' && --depth === 0) return source.slice(start, index + 1);
    }
    return null;
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableJson(item)).join(',')}]`;
    if (value && typeof value === 'object')
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableJson(item)}`)
        .join(',')}}`;
    return JSON.stringify(value) ?? 'null';
  }
}
