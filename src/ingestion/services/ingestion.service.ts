import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { normalizeRichTextDescription } from 'src/common/helpers/rich-text.helper';
import { ProjectActivitiesService } from 'src/project-activities/services/project-activities.service';
import { ProjectActivity } from 'src/typeorm/entities/ProjectActivity';
import { Project } from 'src/typeorm/entities/Project';
import { IngestApiKey } from 'src/typeorm/entities/IngestApiKey';
import { IngestedEvent } from 'src/typeorm/entities/IngestedEvent';
import { Status } from 'src/typeorm/entities/Status';
import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';
import { ActivityType } from 'src/utils/constants/activity';
import { EntityManager, In, Repository } from 'typeorm';
import { CreateIngestedTaskDto } from '../dto/create-ingested-task.dto';
import { IngestionRequestContext } from '../guards/ingestion-api-key.guard';
import { ClosedTaskDedupeBehavior } from '../constants/closed-task-dedupe-behavior';
import { ProjectIngestionSettings } from 'src/typeorm/entities/ProjectIngestionSettings';
import { ProjectsGateway } from 'src/projects/projects.gateway';
import { CustomWorkflowsService } from 'src/custom-workflows/custom-workflows.service';
import { NormalizedIntakeService } from './normalized-intake.service';
import { CustomFieldsService } from 'src/custom-fields/custom-fields.service';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { AuthUser } from 'src/types/users';
import { IntakeEvent } from 'src/typeorm/entities/IntakeEvent';
import { IntakeChannel } from 'src/typeorm/entities/IntakeEvent';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';

type IngestionMutationResult = {
  status: 'created' | 'deduped';
  taskId: number;
  occurrenceCount: number;
  realtimeAction: 'created' | 'deduped' | 'reopened';
};

@Injectable()
export class IngestionService {
  constructor(
    private readonly projectActivitiesService: ProjectActivitiesService,
    @Inject(forwardRef(() => ProjectsGateway))
    private readonly projectsGateway: ProjectsGateway,
    private readonly customWorkflowsService: CustomWorkflowsService,
    private readonly normalizedIntakeService: NormalizedIntakeService,
    private readonly customFieldsService: CustomFieldsService,
    private readonly authorizationService: AuthorizationService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Status)
    private readonly statusRepository: Repository<Status>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(IngestApiKey)
    private readonly ingestApiKeyRepository: Repository<IngestApiKey>,
    @InjectRepository(IngestedEvent)
    private readonly ingestedEventRepository: Repository<IngestedEvent>,
    @InjectRepository(ProjectIngestionSettings)
    private readonly projectIngestionSettingsRepository: Repository<ProjectIngestionSettings>,
  ) {}

  async ingestTaskEvent(
    dto: CreateIngestedTaskDto,
    context: IngestionRequestContext,
  ) {
    const key = await this.ingestApiKeyRepository.findOne({
      where: {
        id: context.ingestKeyId,
        projectId: context.projectId,
        organization_id: context.organizationId,
      },
    });

    if (!key || key.revoked_at) {
      throw new HttpException(
        'Invalid ingestion API key',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const project = await this.projectRepository.findOne({
      where: {
        id: context.projectId,
        organization_id: context.organizationId,
      },
      relations: ['user', 'defaultIngestionStatus'],
    });

    if (!project) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }

    if (context.isTestKey) {
      const targetStatus = await this.resolveTargetStatus(project);
      return {
        status: 'validated',
        test: true,
        projectId: project.id,
        targetStatusId: targetStatus.id,
      };
    }

    const dedupeKey = dto.dedupeKey?.trim() || null;
    const received = await this.normalizedIntakeService.receive({
      organizationId: project.organization_id,
      projectId: project.id,
      channel: dto.source === 'sdk' ? 'sdk' : 'api',
      sourceKey: `ingest-key:${context.ingestKeyId}`,
      idempotencyKey: dto.idempotencyKey,
      taskDedupeKey: dedupeKey,
      normalizedPayload: {
        source: dto.source,
        title: dto.title,
        description: dto.description ?? null,
        description_html: dto.description_html ?? null,
        severity: dto.severity ?? 'medium',
        priority: dto.priority ?? 0,
        metadata: dto.metadata ?? null,
        occurredAt: dto.occurredAt ?? null,
        customFields: dto.customFields ?? [],
      },
      receivedAt: this.resolveOccurredAt(dto.occurredAt),
    });

    const processed = await this.processEvent(received.event, dto, project);
    const result = processed.outcome;

    if (!processed.idempotent) {
      this.projectsGateway.emitIngestionUpdated({
        projectId: project.id,
        taskId: result.taskId,
        action: result.realtimeAction,
        occurrenceCount: result.occurrenceCount,
        source: dto.source,
        dedupeKey,
      });
    }

    return {
      status: result.status,
      taskId: result.taskId,
      occurrenceCount: result.occurrenceCount,
      eventId: processed.event.id,
      idempotent: received.idempotent || processed.idempotent,
    };
  }

  async getIntakeEvent(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    eventId: string,
  ) {
    await this.authorizationService.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    const event = await this.normalizedIntakeService.findScoped(
      organizationId,
      projectId,
      eventId,
    );
    if (!event) throw new HttpException('Intake event not found', 404);
    return event;
  }

  async listIntakeEvents(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    options: {
      page?: number;
      limit?: number;
      state?: IntakeEvent['state'];
      channel?: IntakeEvent['channel'];
    },
  ) {
    await this.authorizationService.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    return this.normalizedIntakeService.listScoped(
      organizationId,
      projectId,
      Math.max(1, options.page ?? 1),
      Math.min(100, Math.max(1, options.limit ?? 25)),
      options.state,
      options.channel,
    );
  }

  async processImportedRow(input: {
    organizationId: string;
    projectId: number;
    channel: Extract<IntakeChannel, 'csv' | 'excel'>;
    sourceKey: string;
    idempotencyKey: string;
    dto: CreateIngestedTaskDto;
  }) {
    const project = await this.projectRepository.findOne({
      where: {
        id: input.projectId,
        organization_id: input.organizationId,
      },
      relations: ['user', 'defaultIngestionStatus'],
    });
    if (!project) throw new HttpException('Project not found', 404);
    const received = await this.normalizedIntakeService.receive({
      organizationId: input.organizationId,
      projectId: input.projectId,
      channel: input.channel,
      sourceKey: input.sourceKey,
      idempotencyKey: input.idempotencyKey,
      taskDedupeKey: input.dto.dedupeKey ?? null,
      normalizedPayload: {
        source: input.dto.source,
        title: input.dto.title,
        description: input.dto.description ?? null,
        severity: input.dto.severity ?? 'medium',
        priority: input.dto.priority ?? 0,
        customFields: input.dto.customFields ?? [],
      },
    });
    return this.processEvent(received.event, input.dto, project);
  }

  async processWebhookEvent(input: {
    organizationId: string;
    projectId: number;
    sourceKey: string;
    idempotencyKey: string;
    dto: CreateIngestedTaskDto;
  }) {
    const project = await this.projectRepository.findOne({
      where: { id: input.projectId, organization_id: input.organizationId },
      relations: ['user', 'defaultIngestionStatus'],
    });
    if (!project) throw new HttpException('Project not found', 404);
    const received = await this.normalizedIntakeService.receive({
      organizationId: input.organizationId,
      projectId: input.projectId,
      channel: 'webhook',
      sourceKey: input.sourceKey,
      idempotencyKey: input.idempotencyKey,
      taskDedupeKey: input.dto.dedupeKey ?? null,
      normalizedPayload: {
        source: input.dto.source,
        title: input.dto.title,
        description: input.dto.description ?? null,
        severity: input.dto.severity ?? 'medium',
        priority: input.dto.priority ?? 0,
        customFields: input.dto.customFields ?? [],
      },
    });
    return this.processEvent(received.event, input.dto, project);
  }

  async processReceivedEmailEvent(
    event: IntakeEvent,
    dto: CreateIngestedTaskDto,
  ) {
    const project = await this.projectRepository.findOne({
      where: {
        id: event.project_id,
        organization_id: event.organization_id,
      },
      relations: ['user', 'defaultIngestionStatus'],
    });
    if (!project) throw new HttpException('Project not found', 404);
    return this.processEvent(event, dto, project);
  }

  async retryIntakeEvent(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    eventId: string,
    reprocess = false,
  ) {
    const event = await this.getIntakeEvent(
      actor,
      organizationId,
      projectId,
      eventId,
    );
    if (event.channel === 'form') {
      throw new HttpException(
        'Request Form submissions use their form-specific retry workflow',
        409,
      );
    }
    if (!reprocess && (event.state !== 'failed' || !event.retryable)) {
      throw new HttpException(
        'Only retryable failed events can be retried',
        409,
      );
    }
    if (reprocess && !['rejected', 'quarantined'].includes(event.state)) {
      throw new HttpException(
        'Only rejected or quarantined events can be reprocessed',
        409,
      );
    }
    const project = await this.projectRepository.findOne({
      where: { id: projectId, organization_id: organizationId },
      relations: ['user', 'defaultIngestionStatus'],
    });
    if (!project) throw new HttpException('Project not found', 404);
    const dto = this.dtoFromEvent(event);
    if (reprocess) event.state = 'failed';
    return this.processEvent(
      event,
      dto,
      project,
      reprocess ? 'reprocess' : 'manual_retry',
    );
  }

  private dtoFromEvent(event: IntakeEvent): CreateIngestedTaskDto {
    const payload = event.normalized_payload;
    return {
      source:
        (payload.source as CreateIngestedTaskDto['source']) ??
        (event.channel === 'sdk' ? 'sdk' : 'api'),
      title: String(payload.title ?? ''),
      description: (payload.description as string | null) ?? undefined,
      description_html:
        (payload.description_html as string | null) ?? undefined,
      severity: payload.severity as CreateIngestedTaskDto['severity'],
      priority: Number(payload.priority ?? 0),
      metadata:
        (payload.metadata as Record<string, unknown> | null) ?? undefined,
      occurredAt: (payload.occurredAt as string | null) ?? undefined,
      dedupeKey: event.task_dedupe_key ?? undefined,
      idempotencyKey: event.idempotency_key,
      customFields:
        (payload.customFields as CreateIngestedTaskDto['customFields']) ?? [],
    };
  }

  private processEvent(
    event: IntakeEvent,
    dto: CreateIngestedTaskDto,
    project: Project,
    trigger?: 'manual_retry' | 'reprocess',
  ) {
    const dedupeKey = event.task_dedupe_key ?? dto.dedupeKey?.trim() ?? null;
    return this.normalizedIntakeService.process(
      event,
      async (manager) => {
        const targetStatus = await this.resolveTargetStatus(project);
        const ingestionSettings =
          await this.projectIngestionSettingsRepository.findOne({
            where: { projectId: project.id },
          });
        if (dedupeKey) {
          const existing = await manager.getRepository(IngestedEvent).findOne({
            where: { projectId: project.id, dedupe_key: dedupeKey },
            relations: ['task', 'task.status'],
          });
          if (existing) {
            return this.handleDuplicateEvent(
              manager,
              existing,
              dto,
              project,
              targetStatus,
              ingestionSettings?.closedTaskDedupeBehavior ?? 'reopen',
              ingestionSettings?.reopenIfRecentWindowDays ?? 7,
            );
          }
        }
        return this.createTaskFromEvent(
          manager,
          dto,
          project,
          targetStatus,
          dedupeKey,
        );
      },
      trigger,
    );
  }

  private async resolveTargetStatus(project: Project): Promise<Status> {
    if (!project.default_ingestion_status_id) {
      throw new HttpException(
        'Set a default ingestion status before using ingestion',
        HttpStatus.BAD_REQUEST,
      );
    }

    const status = await this.statusRepository.findOne({
      where: {
        id: project.default_ingestion_status_id,
        project: { id: project.id },
        organization_id: project.organization_id,
      },
      relations: ['project'],
    });

    if (!status) {
      throw new HttpException(
        'Default ingestion status is invalid for this project',
        HttpStatus.BAD_REQUEST,
      );
    }

    return status;
  }

  private async createTaskFromEvent(
    manager: EntityManager,
    dto: CreateIngestedTaskDto,
    project: Project,
    targetStatus: Status,
    dedupeKey: string | null,
  ): Promise<IngestionMutationResult> {
    const richDescription = normalizeRichTextDescription({
      description: dto.description,
      description_html: dto.description_html,
    });

    const taskRepository = manager.getRepository(Task);
    const ingestedEventRepository = manager.getRepository(IngestedEvent);
    const assignees = await this.resolveIngestionAssignees(manager, dto, project);

    const task = taskRepository.create({
      title: dto.title,
      description: richDescription?.description ?? '',
      description_html: richDescription?.description_html ?? null,
      priority: dto.priority ?? 0,
      severity: dto.severity ?? 'medium',
      project,
      status: targetStatus,
      user: project.user,
      organization_id: project.organization_id,
      organization: project.organization ?? null,
      assignees,
    });

    const savedTask = await taskRepository.save(task);

    await this.customFieldsService.setTaskValuesInTransaction(
      manager,
      project.organization_id,
      project.id,
      savedTask.id,
      dto.customFields ?? [],
      true,
    );

    if (dedupeKey) {
      const event = ingestedEventRepository.create({
        taskId: savedTask.id,
        task: savedTask,
        projectId: project.id,
        project,
        organization_id: project.organization_id,
        organization: project.organization ?? undefined,
        source: dto.source,
        severity: dto.severity ?? 'medium',
        dedupe_key: dedupeKey,
        metadata: dto.metadata ?? null,
        occurrence_count: 1,
        first_seen_at: this.resolveOccurredAt(dto.occurredAt),
        last_seen_at: this.resolveOccurredAt(dto.occurredAt),
      });
      await ingestedEventRepository.save(event);
    }

    await this.createActivityWithManager(manager, {
      organization_id: project.organization_id,
      projectId: project.id,
      userId: Number(project.user.id),
      activityType: ActivityType.TASK_INGESTED,
      description: `Task ingested: ${savedTask.title ?? ''}`,
      entityType: 'task',
      entityId: savedTask.id,
      metadata: {
        source: dto.source,
        severity: dto.severity ?? 'medium',
        dedupeKey,
      },
    });

    return {
      status: 'created',
      taskId: savedTask.id,
      occurrenceCount: 1,
      realtimeAction: 'created',
    };
  }

  private async resolveIngestionAssignees(
    manager: EntityManager,
    dto: CreateIngestedTaskDto,
    project: Project,
  ) {
    const emails = [...new Set(dto.assigneeEmails ?? [])];
    if (!emails.length) return [];
    const users = await manager.getRepository(User).find({
      where: { email: In(emails), is_active: true },
    });
    const byEmail = new Map(
      users.map((user) => [user.email.toLowerCase(), user]),
    );
    const userIds = users.map((user) => Number(user.id));
    const peers = userIds.length
      ? await manager.getRepository(ProjectPeer).find({
          where: {
            project: { id: project.id },
            user: { id: In(userIds) },
            organization_id: project.organization_id,
            status: ProjectPeerStatus.CONNECTED,
            is_confirmed: true,
          },
          relations: ['user'],
        })
      : [];
    const allowed = new Set([
      Number(project.user.id),
      ...peers.map((peer) => Number(peer.user.id)),
    ]);
    const resolved = emails.map((email) => byEmail.get(email.toLowerCase()));
    const invalid = emails.filter((email, index) => {
      const user = resolved[index];
      return !user || !allowed.has(Number(user.id));
    });
    if (invalid.length)
      throw new HttpException(
        `Assignees must be active project members: ${invalid.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    return resolved as User[];
  }

  private async handleDuplicateEvent(
    manager: EntityManager,
    event: IngestedEvent,
    dto: CreateIngestedTaskDto,
    project: Project,
    targetStatus: Status,
    closedTaskBehavior: ClosedTaskDedupeBehavior,
    reopenIfRecentWindowDays: number,
  ): Promise<IngestionMutationResult> {
    const taskRepository = manager.getRepository(Task);
    const ingestedEventRepository = manager.getRepository(IngestedEvent);

    const task = await taskRepository.findOne({
      where: { id: event.taskId },
      relations: ['status', 'project'],
    });

    if (!task) {
      throw new HttpException(
        'Previously ingested task no longer exists',
        HttpStatus.CONFLICT,
      );
    }

    if (task.status?.isTerminal && closedTaskBehavior === 'create_new') {
      return this.createTaskFromEvent(
        manager,
        dto,
        project,
        targetStatus,
        dto.dedupeKey?.trim() || null,
      );
    }

    if (
      task.status?.isTerminal &&
      closedTaskBehavior === 'reopen_if_recent' &&
      !this.wasTaskClosedRecently(task, reopenIfRecentWindowDays)
    ) {
      return this.createTaskFromEvent(
        manager,
        dto,
        project,
        targetStatus,
        dto.dedupeKey?.trim() || null,
      );
    }

    event.occurrence_count += 1;
    event.last_seen_at = this.resolveOccurredAt(dto.occurredAt);
    event.metadata = dto.metadata ?? event.metadata;
    event.severity = dto.severity ?? event.severity;

    const nextSeverity = dto.severity ?? event.severity ?? task.severity;
    const shouldUpdateSeverity = nextSeverity && task.severity !== nextSeverity;

    if (shouldUpdateSeverity) {
      task.severity = nextSeverity;
    }

    let realtimeAction: IngestionMutationResult['realtimeAction'] = 'deduped';

    if (task.status?.isTerminal) {
      await this.customWorkflowsService.transitionTask(
        manager,
        {
          userId: Number(project.user.id),
          email: project.user.email ?? '',
          role: 'user',
        },
        project.organization_id,
        task,
        targetStatus.id,
      );
      realtimeAction = 'reopened';

      await this.createActivityWithManager(manager, {
        organization_id: project.organization_id,
        projectId: project.id,
        userId: Number(project.user.id),
        activityType: ActivityType.TASK_REOPENED_BY_INGESTION,
        description: `Task reopened by ingestion: ${task.title ?? ''}`,
        entityType: 'task',
        entityId: task.id,
        metadata: {
          source: dto.source,
          severity: dto.severity ?? event.severity,
          dedupeKey: event.dedupe_key,
        },
      });
    } else if (shouldUpdateSeverity) {
      await taskRepository.save(task);
    }

    await ingestedEventRepository.save(event);

    return {
      status: 'deduped',
      taskId: task.id,
      occurrenceCount: event.occurrence_count,
      realtimeAction,
    };
  }

  private resolveOccurredAt(value?: string): Date {
    if (!value) {
      return new Date();
    }

    const occurredAt = new Date(value);
    if (Number.isNaN(occurredAt.getTime())) {
      return new Date();
    }

    return occurredAt;
  }

  private wasTaskClosedRecently(
    task: Task,
    reopenIfRecentWindowDays: number,
  ): boolean {
    if (!task.updated_at) {
      return false;
    }

    const closedAt = new Date(task.updated_at);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - reopenIfRecentWindowDays);

    return closedAt >= threshold;
  }

  private async createActivityWithManager(
    manager: EntityManager,
    data: Parameters<ProjectActivitiesService['createActivity']>[0],
  ) {
    const activityRepository = manager.getRepository(ProjectActivity);
    const activity = activityRepository.create(data);
    return activityRepository.save(activity);
  }
}
