import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
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
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  CreateIngestedTaskDto,
} from '../dto/create-ingested-task.dto';
import { IngestionRequestContext } from '../guards/ingestion-api-key.guard';
import { ClosedTaskDedupeBehavior } from '../constants/closed-task-dedupe-behavior';
import { ProjectIngestionSettings } from 'src/typeorm/entities/ProjectIngestionSettings';
import { ProjectsGateway } from 'src/projects/projects.gateway';

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
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

    const targetStatus = await this.resolveTargetStatus(project);
    const ingestionSettings =
      await this.projectIngestionSettingsRepository.findOne({
        where: { projectId: project.id },
      });

    if (context.isTestKey) {
      return {
        status: 'validated',
        test: true,
        projectId: project.id,
        targetStatusId: targetStatus.id,
      };
    }

    const dedupeKey = dto.dedupeKey?.trim() || null;
    const result = await this.dataSource.transaction(async (manager) => {
      if (dedupeKey) {
        const existing = await manager.getRepository(IngestedEvent).findOne({
          where: {
            projectId: project.id,
            dedupe_key: dedupeKey,
          },
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
    });

    this.projectsGateway.emitIngestionUpdated({
      projectId: project.id,
      taskId: result.taskId,
      action: result.realtimeAction,
      occurrenceCount: result.occurrenceCount,
      source: dto.source,
      dedupeKey,
    });

    return {
      status: result.status,
      taskId: result.taskId,
      occurrenceCount: result.occurrenceCount,
    };
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
    });

    const savedTask = await taskRepository.save(task);

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
      task.status = targetStatus;
      await taskRepository.save(task);
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
