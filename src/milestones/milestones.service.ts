import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import {
  Milestone,
  MilestoneStatus,
} from 'src/typeorm/entities/Milestone';
import { MilestoneTask } from 'src/typeorm/entities/MilestoneTask';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Task } from 'src/typeorm/entities/Task';
import { AuthUser } from 'src/types/users';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { ProjectActivitiesService } from 'src/project-activities/services/project-activities.service';
import { ActivityType } from 'src/utils/constants/activity';
import { DataSource, EntityManager, FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import {
  CreateMilestoneDto,
  MilestoneListQueryDto,
  MilestoneTaskLinkDto,
  ReplaceMilestoneTasksDto,
  TransitionMilestoneDto,
  UpdateMilestoneDto,
} from './dto/milestone.dto';

@Injectable()
export class MilestonesService {
  constructor(
    @InjectRepository(Milestone)
    private readonly milestones: Repository<Milestone>,
    @InjectRepository(ProjectPeer)
    private readonly projectPeers: Repository<ProjectPeer>,
    private readonly authorization: AuthorizationService,
    private readonly dataSource: DataSource,
    private readonly activities: ProjectActivitiesService,
  ) {}

  async list(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    query: MilestoneListQueryDto,
    includeArchived = false,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const where: FindOptionsWhere<Milestone> = {
      organization_id: organizationId,
      project_id: projectId,
      ...(includeArchived ? {} : { archived_at: IsNull() }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.health ? { health: query.health } : {}),
      ...(query.ownerId ? { owner_id: Number(query.ownerId) } : {}),
    };
    const [items, total] = await this.milestones.findAndCount({
      where,
      relations: this.relations(),
      order: { target_date: 'ASC', created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      success: true,
      data: items.map((item) => this.serialize(item)),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async get(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    milestoneId: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    const item = await this.findScoped(
      this.milestones.manager,
      organizationId,
      projectId,
      milestoneId,
    );
    return { success: true, data: this.serialize(item) };
  }

  async create(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    dto: CreateMilestoneDto,
  ) {
    const context = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    if (dto.ownerId)
      await this.assertProjectMember(
        projectId,
        dto.ownerId,
        Number(context.project.user?.id),
      );
    const links = dto.taskLinks ?? [];
    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Milestone);
      const item = await repo.save(
        repo.create({
          organization_id: organizationId,
          project_id: projectId,
          title: dto.title.trim(),
          description: this.optionalText(dto.description),
          completion_criteria: this.optionalText(dto.completionCriteria),
          target_date: dto.targetDate ?? null,
          health: dto.health,
          owner_id: dto.ownerId ?? null,
          created_by_id: actor.userId,
        }),
      );
      await this.replaceTaskLinks(manager, item.id, projectId, links);
      const saved = await this.findScoped(
        manager,
        organizationId,
        projectId,
        item.id,
      );
      return {
        success: true,
        message: 'Milestone created',
        data: this.serialize(saved),
      };
    });
    await this.recordActivity(actor, organizationId, projectId, 'created', result.data);
    return result;
  }

  async update(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    milestoneId: string,
    dto: UpdateMilestoneDto,
  ) {
    const context = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    if (dto.ownerId)
      await this.assertProjectMember(
        projectId,
        dto.ownerId,
        Number(context.project.user?.id),
      );
    const result = await this.dataSource.transaction(async (manager) => {
      const item = await this.findScoped(
        manager,
        organizationId,
        projectId,
        milestoneId,
      );
      if (item.archived_at)
        throw new BadRequestException('Archived milestones cannot be edited');
      if (dto.title !== undefined) item.title = dto.title.trim();
      if (dto.description !== undefined)
        item.description = this.optionalText(dto.description);
      if (dto.completionCriteria !== undefined)
        item.completion_criteria = this.optionalText(dto.completionCriteria);
      if (dto.targetDate !== undefined)
        item.target_date = dto.targetDate ?? null;
      if (dto.health !== undefined) item.health = dto.health;
      if (dto.ownerId !== undefined) item.owner_id = dto.ownerId;
      await manager.getRepository(Milestone).save(item);
      const saved = await this.findScoped(
        manager,
        organizationId,
        projectId,
        milestoneId,
      );
      return {
        success: true,
        message: 'Milestone updated',
        data: this.serialize(saved),
      };
    });
    await this.recordActivity(actor, organizationId, projectId, 'updated', result.data);
    return result;
  }

  async replaceTasks(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    milestoneId: string,
    dto: ReplaceMilestoneTasksDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    const result = await this.dataSource.transaction(async (manager) => {
      const item = await this.findScoped(
        manager,
        organizationId,
        projectId,
        milestoneId,
      );
      if (item.archived_at)
        throw new BadRequestException('Archived milestones cannot be edited');
      await this.replaceTaskLinks(
        manager,
        milestoneId,
        projectId,
        dto.taskLinks,
      );
      const saved = await this.findScoped(
        manager,
        organizationId,
        projectId,
        milestoneId,
      );
      return {
        success: true,
        message: 'Milestone tasks updated',
        data: this.serialize(saved),
      };
    });
    await this.recordActivity(actor, organizationId, projectId, 'tasks_updated', result.data, { taskCount: dto.taskLinks.length });
    return result;
  }

  async archive(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    milestoneId: string,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.MANAGE_SETTINGS,
    );
    const item = await this.findScoped(
      this.milestones.manager,
      organizationId,
      projectId,
      milestoneId,
    );
    if (!item.archived_at) {
      item.archived_at = new Date();
      await this.milestones.save(item);
      await this.recordActivity(actor, organizationId, projectId, 'archived', this.serialize(item));
    }
    return { success: true, message: 'Milestone archived' };
  }

  async transition(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    milestoneId: string,
    dto: TransitionMilestoneDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    const result = await this.dataSource.transaction(async (manager) => {
      const item = await this.findScoped(
        manager,
        organizationId,
        projectId,
        milestoneId,
        true,
      );
      if (item.archived_at)
        throw new BadRequestException('Archived milestones cannot be edited');
      const progress = this.calculateProgress(item);
      const reason = dto.reason?.trim() || null;
      if (
        dto.status === MilestoneStatus.COMPLETED &&
        progress.openTasks > 0 &&
        !reason
      )
        throw new BadRequestException(
          'A completion reason is required while milestone tasks remain open',
        );

      item.status = dto.status;
      if (dto.status === MilestoneStatus.COMPLETED) {
        item.achieved_at = item.achieved_at ?? new Date();
        item.completion_reason = reason;
      } else {
        item.achieved_at = null;
        item.completion_reason = null;
      }
      await manager.getRepository(Milestone).save(item);
      const saved = await this.findScoped(
        manager,
        organizationId,
        projectId,
        milestoneId,
      );
      return {
        success: true,
        message: 'Milestone status updated',
        data: this.serialize(saved),
      };
    });
    await this.recordActivity(actor, organizationId, projectId, 'status_changed', result.data, { status: dto.status });
    return result;
  }

  private async replaceTaskLinks(
    manager: EntityManager,
    milestoneId: string,
    projectId: number,
    links: MilestoneTaskLinkDto[],
  ) {
    const taskIds = links.map((link) => Number(link.taskId));
    if (new Set(taskIds).size !== taskIds.length)
      throw new BadRequestException('Milestone task links must be unique');
    if (taskIds.length) {
      const tasks = await manager.getRepository(Task).find({
        where: { id: In(taskIds), project: { id: projectId } },
        relations: ['project'],
      });
      if (tasks.length !== taskIds.length)
        throw new BadRequestException(
          'A linked task does not belong to this project',
        );
    }
    const repo = manager.getRepository(MilestoneTask);
    await repo.delete({ milestone_id: milestoneId });
    if (links.length)
      await repo.save(
        links.map((link) =>
          repo.create({
            milestone_id: milestoneId,
            task_id: Number(link.taskId),
            counts_toward_progress: link.countsTowardProgress ?? true,
          }),
        ),
      );
  }

  private async assertProjectMember(
    projectId: number,
    userId: number,
    projectCreatorId: number,
  ) {
    if (Number(userId) === Number(projectCreatorId)) return;
    const exists = await this.projectPeers.exists({
      where: {
        project: { id: projectId },
        user: { id: userId },
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
    });
    if (!exists)
      throw new BadRequestException(
        'Milestone owner must be an active project member',
      );
  }

  private async findScoped(
    manager: EntityManager,
    organizationId: string,
    projectId: number,
    milestoneId: string,
    lock = false,
  ) {
    const item = await manager.getRepository(Milestone).findOne({
      where: {
        id: milestoneId,
        organization_id: organizationId,
        project_id: projectId,
      },
      relations: this.relations(),
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!item) throw new NotFoundException('Milestone not found');
    return item;
  }

  private relations() {
    return [
      'owner',
      'created_by',
      'task_links',
      'task_links.task',
      'task_links.task.status',
    ];
  }

  private serialize(item: Milestone) {
    const progress = this.calculateProgress(item);
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      completionCriteria: item.completion_criteria,
      targetDate: item.target_date,
      status: item.status,
      health: item.health,
      owner: item.owner
        ? {
            id: Number(item.owner.id),
            name: item.owner.fullName || item.owner.email,
          }
        : null,
      createdBy: item.created_by
        ? {
            id: Number(item.created_by.id),
            name: item.created_by.fullName || item.created_by.email,
          }
        : null,
      achievedAt: item.achieved_at,
      completionReason: item.completion_reason,
      archivedAt: item.archived_at,
      taskLinks: (item.task_links ?? []).map((link) => ({
        taskId: link.task_id,
        title: link.task?.title,
        status: link.task?.status
          ? {
              id: link.task.status.id,
              title: link.task.status.title,
              isTerminal: link.task.status.isTerminal,
            }
          : null,
        countsTowardProgress: link.counts_toward_progress,
      })),
      progress,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }

  private calculateProgress(item: Milestone) {
    const eligible = (item.task_links ?? []).filter(
      (link) => link.counts_toward_progress,
    );
    const completedTasks = eligible.filter(
      (link) => link.task?.status?.isTerminal,
    ).length;
    const eligibleTasks = eligible.length;
    return {
      percent: eligibleTasks
        ? Math.round((completedTasks / eligibleTasks) * 100)
        : 0,
      eligibleTasks,
      completedTasks,
      openTasks: eligibleTasks - completedTasks,
    };
  }

  private optionalText(value?: string | null) {
    return value?.trim() || null;
  }

  private recordActivity(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    action: string,
    milestone: { id: string; title: string; status?: MilestoneStatus; health?: unknown; targetDate?: string | null; progress?: unknown },
    metadata: Record<string, unknown> = {},
  ) {
    return this.activities.createActivity({
      organization_id: organizationId,
      projectId,
      userId: actor.userId,
      activityType: ActivityType.PROJECT_UPDATED,
      description: `${action === 'created' ? 'Created' : action === 'archived' ? 'Archived' : 'Updated'} milestone "${milestone.title}"`,
      entityType: 'milestone',
      metadata: {
        action,
        milestoneId: milestone.id,
        title: milestone.title,
        status: milestone.status,
        health: milestone.health,
        targetDate: milestone.targetDate,
        progress: milestone.progress,
        ...metadata,
      },
    });
  }
}
