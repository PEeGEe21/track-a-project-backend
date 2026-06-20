import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { normalizeRichTextDescription } from 'src/common/helpers/rich-text.helper';
import { ProjectActivitiesService } from 'src/project-activities/services/project-activities.service';
import { Project } from 'src/typeorm/entities/Project';
import { IngestApiKey } from 'src/typeorm/entities/IngestApiKey';
import { IngestedEvent } from 'src/typeorm/entities/IngestedEvent';
import { Status } from 'src/typeorm/entities/Status';
import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';
import { ActivityType } from 'src/utils/constants/activity';
import { Repository } from 'typeorm';
import {
  CreateIngestedTaskDto,
} from '../dto/create-ingested-task.dto';
import { IngestionRequestContext } from '../guards/ingestion-api-key.guard';

@Injectable()
export class IngestionService {
  constructor(
    private readonly projectActivitiesService: ProjectActivitiesService,
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

    if (context.isTestKey) {
      return {
        status: 'validated',
        test: true,
        projectId: project.id,
        targetStatusId: targetStatus.id,
      };
    }

    const dedupeKey = dto.dedupeKey?.trim() || null;
    if (dedupeKey) {
      const existing = await this.ingestedEventRepository.findOne({
        where: {
          projectId: project.id,
          dedupe_key: dedupeKey,
        },
        relations: ['task', 'task.status'],
      });

      if (existing) {
        return this.handleDuplicateEvent(existing, dto, project, targetStatus);
      }
    }

    return this.createTaskFromEvent(dto, project, targetStatus, dedupeKey);
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
    dto: CreateIngestedTaskDto,
    project: Project,
    targetStatus: Status,
    dedupeKey: string | null,
  ) {
    const richDescription = normalizeRichTextDescription({
      description: dto.description,
      description_html: dto.description_html,
    });

    const task = this.taskRepository.create({
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

    const savedTask = await this.taskRepository.save(task);

    if (dedupeKey) {
      const event = this.ingestedEventRepository.create({
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
        last_seen_at: this.resolveOccurredAt(dto.occurredAt),
      });
      await this.ingestedEventRepository.save(event);
    }

    await this.projectActivitiesService.createActivity({
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
    };
  }

  private async handleDuplicateEvent(
    event: IngestedEvent,
    dto: CreateIngestedTaskDto,
    project: Project,
    targetStatus: Status,
  ) {
    event.occurrence_count += 1;
    event.last_seen_at = this.resolveOccurredAt(dto.occurredAt);
    event.metadata = dto.metadata ?? event.metadata;
    event.severity = dto.severity ?? event.severity;

    const task = await this.taskRepository.findOne({
      where: { id: event.taskId },
      relations: ['status', 'project'],
    });

    if (!task) {
      throw new HttpException(
        'Previously ingested task no longer exists',
        HttpStatus.CONFLICT,
      );
    }

    const nextSeverity = dto.severity ?? event.severity ?? task.severity;
    const shouldUpdateSeverity = nextSeverity && task.severity !== nextSeverity;

    if (shouldUpdateSeverity) {
      task.severity = nextSeverity;
    }

    if (task.status?.isTerminal) {
      task.status = targetStatus;
      await this.taskRepository.save(task);

      await this.projectActivitiesService.createActivity({
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
      await this.taskRepository.save(task);
    }

    await this.ingestedEventRepository.save(event);

    return {
      status: 'deduped',
      taskId: task.id,
      occurrenceCount: event.occurrence_count,
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
}
