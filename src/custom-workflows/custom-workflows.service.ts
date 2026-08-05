import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { ProjectWorkflow } from 'src/typeorm/entities/ProjectWorkflow';
import { ProjectWorkflowStatus } from 'src/typeorm/entities/ProjectWorkflowStatus';
import { ProjectWorkflowTransition } from 'src/typeorm/entities/ProjectWorkflowTransition';
import { ProjectWorkflowVersion } from 'src/typeorm/entities/ProjectWorkflowVersion';
import { Status } from 'src/typeorm/entities/Status';
import { Task } from 'src/typeorm/entities/Task';
import { TaskCustomFieldValue } from 'src/typeorm/entities/TaskCustomFieldValue';
import { TaskTransitionHistory } from 'src/typeorm/entities/TaskTransitionHistory';
import { User } from 'src/typeorm/entities/User';
import { AuthUser } from 'src/types/users';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  PublishWorkflowDto,
  UpdateWorkflowDraftDto,
  WorkflowStatusDto,
  WorkflowTransitionDto,
} from './dto/custom-workflow.dto';
import { TRANSITION_ROLES, WorkflowVersionState } from './workflow-contract';

@Injectable()
export class CustomWorkflowsService {
  constructor(
    @InjectRepository(ProjectWorkflow)
    private readonly workflows: Repository<ProjectWorkflow>,
    private readonly authorization: AuthorizationService,
    private readonly entitlements: EntitlementsService,
    private readonly dataSource: DataSource,
  ) {}

  async transitionTask(
    manager: EntityManager,
    actor: AuthUser,
    organizationId: string,
    task: Task,
    destinationStatusId: number,
  ) {
    if (Number(task.status?.id) === Number(destinationStatusId)) return null;
    const destination = await manager.getRepository(Status).findOne({
      where: {
        id: destinationStatusId,
        project: { id: task.project.id },
      },
      relations: ['project'],
    });
    if (!destination)
      throw new BadRequestException('Destination status is unavailable');

    const resolved = await this.entitlements.resolveForActor(
      actor,
      organizationId,
    );
    const enabled = resolved.find(
      (item) => item.key === CapabilityKey.CUSTOM_WORKFLOWS,
    )?.enabled;
    if (!enabled) {
      task.status = destination;
      await manager.getRepository(Task).save(task);
      return null;
    }

    const { role } = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      task.project.id,
      ProjectPermission.CONTRIBUTE,
    );
    await this.ensureWorkflow(organizationId, task.project.id);
    const transition = await manager
      .getRepository(ProjectWorkflowTransition)
      .createQueryBuilder('transition')
      .innerJoinAndSelect('transition.version', 'version')
      .innerJoin('version.workflow', 'workflow')
      .innerJoin('workflow.project', 'project')
      .innerJoin('workflow.organization', 'organization')
      .innerJoinAndSelect('transition.source', 'source')
      .innerJoinAndSelect('source.status', 'sourceStatus')
      .innerJoinAndSelect('transition.destination', 'destination')
      .innerJoinAndSelect('destination.status', 'destinationStatus')
      .where('project.id = :projectId', { projectId: task.project.id })
      .andWhere('organization.id = :organizationId', { organizationId })
      .andWhere('version.state = :state', {
        state: WorkflowVersionState.PUBLISHED,
      })
      .andWhere('sourceStatus.id = :sourceStatusId', {
        sourceStatusId: task.status.id,
      })
      .andWhere('destinationStatus.id = :destinationStatusId', {
        destinationStatusId,
      })
      .getOne();
    if (!transition)
      throw new BadRequestException('This workflow transition is not allowed');
    if (!transition.allowed_roles.includes(role))
      throw new ForbiddenException(
        'Your project role cannot perform this transition',
      );

    const validatedFields = await this.validateTransitionRequirements(
      manager,
      task,
      transition,
    );
    const source = task.status;
    task.status = destination;
    await manager.getRepository(Task).save(task);
    const historyRepo = manager.getRepository(TaskTransitionHistory);
    await historyRepo.save(
      historyRepo.create({
        organization_id: organizationId,
        organization: { id: organizationId },
        project_id: task.project.id,
        project: { id: task.project.id },
        task_id: task.id,
        task,
        workflow_version: transition.version,
        transition_key: transition.key,
        source_status_id: source.id,
        source_status_title: source.title,
        destination_status_id: destination.id,
        destination_status_title: destination.title,
        actor: { id: actor.userId } as User,
        validated_fields: validatedFields,
      }),
    );
    return transition;
  }

  async getTaskHistory(
    actor: AuthUser,
    organizationId: string,
    taskId: number,
  ) {
    const task = await this.dataSource.getRepository(Task).findOne({
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
    const history = await this.dataSource
      .getRepository(TaskTransitionHistory)
      .find({
        where: { task_id: taskId, organization_id: organizationId },
        relations: ['actor', 'workflow_version'],
        order: { created_at: 'DESC' },
        take: 100,
      });
    return {
      success: true,
      data: history.map((item) => ({
        id: item.id,
        transitionKey: item.transition_key,
        sourceStatus: {
          id: item.source_status_id,
          title: item.source_status_title,
        },
        destinationStatus: {
          id: item.destination_status_id,
          title: item.destination_status_title,
        },
        workflowVersion: item.workflow_version.version_number,
        actorId: item.actor?.id ?? null,
        validatedFields: item.validated_fields,
        createdAt: item.created_at,
      })),
    };
  }

  async getAllowedTransitions(
    actor: AuthUser,
    organizationId: string,
    taskId: number,
  ) {
    const task = await this.dataSource.getRepository(Task).findOne({
      where: { id: taskId, organization_id: organizationId },
      relations: ['project', 'status'],
    });
    if (!task) throw new NotFoundException('Task not found');
    const { role } = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      task.project.id,
      ProjectPermission.VIEW,
    );
    const transitions = await this.dataSource
      .getRepository(ProjectWorkflowTransition)
      .createQueryBuilder('transition')
      .innerJoin('transition.version', 'version')
      .innerJoin('version.workflow', 'workflow')
      .innerJoin('workflow.project', 'project')
      .innerJoin('workflow.organization', 'organization')
      .innerJoin('transition.source', 'source')
      .innerJoin('source.status', 'sourceStatus')
      .innerJoinAndSelect('transition.destination', 'destination')
      .innerJoinAndSelect('destination.status', 'destinationStatus')
      .where('project.id = :projectId', { projectId: task.project.id })
      .andWhere('organization.id = :organizationId', { organizationId })
      .andWhere('version.state = :state', {
        state: WorkflowVersionState.PUBLISHED,
      })
      .andWhere('sourceStatus.id = :statusId', { statusId: task.status.id })
      .getMany();
    return {
      success: true,
      data: transitions
        .filter((transition) => transition.allowed_roles.includes(role))
        .map((transition) => ({
          key: transition.key,
          label: transition.label,
          status: {
            id: transition.destination.status.id,
            title: transition.destination.status.title,
            color: transition.destination.status.color,
          },
          requirements: transition.requirements,
        })),
    };
  }

  async get(actor: AuthUser, organizationId: string, projectId: number) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.VIEW,
    );
    await this.ensureWorkflow(organizationId, projectId);
    const workflow = await this.loadWorkflow(organizationId, projectId);
    return {
      success: true,
      data: {
        id: workflow.id,
        published: this.serializeVersion(
          workflow.versions.find(
            (version) => version.state === WorkflowVersionState.PUBLISHED,
          ),
        ),
        draft: this.serializeVersion(
          workflow.versions.find(
            (version) => version.state === WorkflowVersionState.DRAFT,
          ),
        ),
      },
    };
  }

  async createDraft(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    await this.ensureWorkflow(organizationId, projectId);
    return this.dataSource.transaction(async (manager) => {
      const workflow = await this.loadWorkflow(
        organizationId,
        projectId,
        manager,
      );
      const existing = workflow.versions.find(
        (version) => version.state === WorkflowVersionState.DRAFT,
      );
      if (existing)
        return { success: true, data: this.serializeVersion(existing) };
      const published = workflow.versions.find(
        (version) => version.state === WorkflowVersionState.PUBLISHED,
      );
      if (!published)
        throw new BadRequestException('Published workflow missing');

      const versionRepo = manager.getRepository(ProjectWorkflowVersion);
      const draft = await versionRepo.save(
        versionRepo.create({
          workflow,
          version_number:
            Math.max(
              ...workflow.versions.map((version) => version.version_number),
            ) + 1,
          state: WorkflowVersionState.DRAFT,
          name: published.name,
          description: published.description,
          created_by: { id: actor.userId } as User,
        }),
      );
      await this.replaceDefinition(
        manager,
        draft,
        published.statuses.map((status) => ({
          statusId: status.status.id,
          key: status.key,
          position: status.position,
          isInitial: status.is_initial,
          isTerminal: status.is_terminal,
        })),
        published.transitions.map((transition) => ({
          key: transition.key,
          label: transition.label ?? undefined,
          sourceStatusId: transition.source.status.id,
          destinationStatusId: transition.destination.status.id,
          allowedRoles: transition.allowed_roles,
          requirements: transition.requirements ?? undefined,
        })),
      );
      const saved = await this.loadVersion(draft.id, manager);
      return { success: true, data: this.serializeVersion(saved) };
    });
  }

  async updateDraft(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    dto: UpdateWorkflowDraftDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.EDIT,
    );
    await this.validateDefinition(organizationId, projectId, dto);
    return this.dataSource.transaction(async (manager) => {
      const workflow = await this.loadWorkflow(
        organizationId,
        projectId,
        manager,
      );
      const draft = workflow.versions.find(
        (version) => version.state === WorkflowVersionState.DRAFT,
      );
      if (!draft)
        throw new BadRequestException('Create a workflow draft first');
      draft.name = dto.name?.trim() || draft.name;
      draft.description = dto.description?.trim() || null;
      await manager.getRepository(ProjectWorkflowVersion).save(draft);
      await this.replaceDefinition(
        manager,
        draft,
        dto.statuses,
        dto.transitions,
      );
      return {
        success: true,
        message: 'Workflow draft updated',
        data: this.serializeVersion(await this.loadVersion(draft.id, manager)),
      };
    });
  }

  async publish(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
    dto: PublishWorkflowDto,
  ) {
    const context = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.MANAGE_SETTINGS,
    );
    if (context.role !== ProjectRole.OWNER && actor.role !== 'super_admin')
      throw new ForbiddenException('Only project owners can publish workflows');

    return this.dataSource.transaction(async (manager) => {
      const workflow = await manager.getRepository(ProjectWorkflow).findOne({
        where: {
          project: { id: projectId },
          organization: { id: organizationId },
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workflow) throw new NotFoundException('Project workflow not found');
      const versions = await manager
        .getRepository(ProjectWorkflowVersion)
        .find({
          where: { workflow: { id: workflow.id } },
          relations: [
            'statuses',
            'statuses.status',
            'transitions',
            'transitions.source',
            'transitions.source.status',
            'transitions.destination',
            'transitions.destination.status',
          ],
        });
      const draft = versions.find(
        (version) => version.state === WorkflowVersionState.DRAFT,
      );
      const published = versions.find(
        (version) => version.state === WorkflowVersionState.PUBLISHED,
      );
      if (!draft) throw new BadRequestException('Workflow draft not found');
      await this.validateDefinition(organizationId, projectId, {
        statuses: draft.statuses.map((item) => ({
          statusId: item.status.id,
          key: item.key,
          position: item.position,
          isInitial: item.is_initial,
          isTerminal: item.is_terminal,
        })),
        transitions: draft.transitions.map((item) => ({
          key: item.key,
          label: item.label ?? undefined,
          sourceStatusId: item.source.status.id,
          destinationStatusId: item.destination.status.id,
          allowedRoles: item.allowed_roles,
          requirements: item.requirements ?? undefined,
        })),
      });

      const draftStatusIds = new Set(
        draft.statuses.map((item) => item.status.id),
      );
      const removed =
        published?.statuses.filter(
          (item) => !draftStatusIds.has(item.status.id),
        ) ?? [];
      const mappings = new Map(
        (dto.migrations ?? []).map((item) => [
          item.fromStatusId,
          item.toStatusId,
        ]),
      );
      for (const removedStatus of removed) {
        const taskCount = await manager.getRepository(Task).count({
          where: {
            project: { id: projectId },
            status: { id: removedStatus.status.id },
          },
        });
        if (!taskCount) continue;
        const destinationId = mappings.get(removedStatus.status.id);
        if (!destinationId || !draftStatusIds.has(destinationId)) {
          throw new BadRequestException(
            `Status ${removedStatus.status.title} is in use and requires a valid migration destination`,
          );
        }
        await manager
          .createQueryBuilder()
          .update(Task)
          .set({ status: { id: destinationId } as Status })
          .where('project_id = :projectId AND status_id = :statusId', {
            projectId,
            statusId: removedStatus.status.id,
          })
          .execute();
      }
      if (published) {
        published.state = WorkflowVersionState.RETIRED;
        await manager.getRepository(ProjectWorkflowVersion).save(published);
      }
      draft.state = WorkflowVersionState.PUBLISHED;
      draft.published_by = { id: actor.userId } as User;
      draft.published_at = new Date();
      await manager.getRepository(ProjectWorkflowVersion).save(draft);
      return {
        success: true,
        message: 'Workflow published',
        data: this.serializeVersion(draft),
      };
    });
  }

  async resetToDefault(
    actor: AuthUser,
    organizationId: string,
    projectId: number,
  ) {
    const context = await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.MANAGE_SETTINGS,
    );
    if (context.role !== ProjectRole.OWNER && actor.role !== 'super_admin')
      throw new ForbiddenException('Only project owners can reset workflows');

    await this.ensureWorkflow(organizationId, projectId);
    return this.dataSource.transaction(async (manager) => {
      const workflow = await manager.getRepository(ProjectWorkflow).findOne({
        where: {
          project: { id: projectId },
          organization: { id: organizationId },
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workflow) throw new NotFoundException('Project workflow not found');

      const statuses = await manager.getRepository(Status).find({
        where: { project: { id: projectId } },
        order: { tabId: 'ASC', id: 'ASC' },
      });
      if (!statuses.length)
        throw new BadRequestException('Project must have at least one status');

      const versionRepo = manager.getRepository(ProjectWorkflowVersion);
      const versions = await versionRepo.find({
        where: { workflow: { id: workflow.id } },
        relations: ['statuses', 'statuses.status'],
      });
      const published = versions.find(
        (version) => version.state === WorkflowVersionState.PUBLISHED,
      );
      const previousInitialStatusId = published?.statuses.find(
        (status) => status.is_initial,
      )?.status.id;
      const initialStatusId = statuses.some(
        (status) => status.id === previousInitialStatusId,
      )
        ? previousInitialStatusId
        : statuses[0].id;

      const activeVersions = versions.filter(
        (version) => version.state !== WorkflowVersionState.RETIRED,
      );
      for (const version of activeVersions)
        version.state = WorkflowVersionState.RETIRED;
      if (activeVersions.length) await versionRepo.save(activeVersions);

      const reset = await versionRepo.save(
        versionRepo.create({
          workflow,
          version_number:
            Math.max(...versions.map((version) => version.version_number)) + 1,
          state: WorkflowVersionState.PUBLISHED,
          name: 'Default workflow',
          description: 'All project statuses and transitions are available.',
          created_by: { id: actor.userId } as User,
          published_by: { id: actor.userId } as User,
          published_at: new Date(),
        }),
      );
      const definitions = statuses.map((status, index) => ({
        statusId: status.id,
        key: `status_${status.id}`,
        position: status.tabId ?? index,
        isInitial: status.id === initialStatusId,
        isTerminal: status.isTerminal,
      }));
      const transitions = statuses.flatMap((source) =>
        statuses
          .filter((destination) => destination.id !== source.id)
          .map((destination) => ({
            key: `status_${source.id}_to_status_${destination.id}`,
            label: `${source.title} → ${destination.title}`,
            sourceStatusId: source.id,
            destinationStatusId: destination.id,
            allowedRoles: [...TRANSITION_ROLES] as ProjectRole[],
            requirements: { standardFields: [], customFieldIds: [] },
          })),
      );
      await this.replaceDefinition(manager, reset, definitions, transitions);

      return {
        success: true,
        message: 'Workflow reset to default',
        data: this.serializeVersion(await this.loadVersion(reset.id, manager)),
      };
    });
  }

  private async validateDefinition(
    organizationId: string,
    projectId: number,
    dto: Pick<UpdateWorkflowDraftDto, 'statuses' | 'transitions'>,
  ) {
    const statusIds = dto.statuses.map((item) => item.statusId);
    if (new Set(statusIds).size !== statusIds.length)
      throw new BadRequestException('Workflow statuses must be unique');
    if (
      new Set(dto.statuses.map((item) => item.key)).size !== dto.statuses.length
    )
      throw new BadRequestException('Workflow status keys must be unique');
    if (
      new Set(dto.transitions.map((item) => item.key)).size !==
      dto.transitions.length
    )
      throw new BadRequestException('Workflow transition keys must be unique');
    if (dto.statuses.filter((item) => item.isInitial).length !== 1)
      throw new BadRequestException(
        'Workflow must have exactly one initial status',
      );
    const statuses = await this.dataSource.getRepository(Status).find({
      where: {
        id: In(statusIds),
        project: { id: projectId },
      },
      relations: ['project'],
    });
    if (statuses.length !== statusIds.length)
      throw new BadRequestException(
        'A workflow status does not belong to this project',
      );

    const edges = new Set<string>();
    const validIds = new Set(statusIds);
    for (const transition of dto.transitions) {
      if (
        !validIds.has(transition.sourceStatusId) ||
        !validIds.has(transition.destinationStatusId)
      )
        throw new BadRequestException(
          'Transition status is outside the workflow',
        );
      if (transition.sourceStatusId === transition.destinationStatusId)
        throw new BadRequestException('Self transitions are not supported');
      const edge = `${transition.sourceStatusId}:${transition.destinationStatusId}`;
      if (edges.has(edge))
        throw new BadRequestException('Duplicate transition edge');
      edges.add(edge);
      if (
        transition.allowedRoles.some(
          (role) => !TRANSITION_ROLES.includes(role as any),
        )
      )
        throw new BadRequestException('Viewer cannot perform transitions');
    }
    const initial = dto.statuses.find((item) => item.isInitial).statusId;
    const reachable = new Set([initial]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const transition of dto.transitions) {
        if (
          reachable.has(transition.sourceStatusId) &&
          !reachable.has(transition.destinationStatusId)
        ) {
          reachable.add(transition.destinationStatusId);
          changed = true;
        }
      }
    }
    if (reachable.size !== statusIds.length)
      throw new BadRequestException('Every workflow status must be reachable');

    const customIds = Array.from(
      new Set(
        dto.transitions.flatMap(
          (transition) => transition.requirements?.customFieldIds ?? [],
        ),
      ),
    );
    if (customIds.length) {
      const count = await this.dataSource
        .getRepository(CustomFieldDefinition)
        .count({
          where: {
            id: In(customIds),
            organization_id: organizationId,
            project_id: projectId,
            archived_at: null,
          },
        });
      if (count !== customIds.length)
        throw new BadRequestException('Required custom field is unavailable');
    }
  }

  private async validateTransitionRequirements(
    manager: EntityManager,
    task: Task,
    transition: ProjectWorkflowTransition,
  ) {
    const standard = transition.requirements?.standardFields ?? [];
    const missing = standard.filter((field) => {
      if (field === 'assignees') return !(task.assignees?.length > 0);
      const value = task[field as keyof Task];
      return value === null || value === undefined || value === '';
    });
    if (missing.length)
      throw new BadRequestException({
        message: 'Required transition fields are missing',
        fields: missing,
      });
    const customIds = transition.requirements?.customFieldIds ?? [];
    if (customIds.length) {
      const values = await manager.getRepository(TaskCustomFieldValue).find({
        where: { task_id: task.id, definition_id: In(customIds) },
      });
      const present = new Set(values.map((value) => value.definition_id));
      const missingCustomFields = customIds.filter((id) => !present.has(id));
      if (missingCustomFields.length)
        throw new BadRequestException({
          message: 'Required custom fields are missing',
          customFieldIds: missingCustomFields,
        });
    }
    return { standardFields: standard, customFieldIds: customIds };
  }

  private async ensureWorkflow(organizationId: string, projectId: number) {
    const exists = await this.workflows.findOne({
      where: {
        project: { id: projectId },
        organization: { id: organizationId },
      },
    });
    if (exists) return;
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ProjectWorkflow);
      const workflow = await repo.save(
        repo.create({
          project: { id: projectId },
          organization: { id: organizationId },
        }),
      );
      const statuses = await manager.getRepository(Status).find({
        where: { project: { id: projectId }, organization_id: organizationId },
        order: { tabId: 'ASC', id: 'ASC' },
      });
      if (!statuses.length)
        throw new BadRequestException('Project must have at least one status');
      const versionRepo = manager.getRepository(ProjectWorkflowVersion);
      const version = await versionRepo.save(
        versionRepo.create({
          workflow,
          version_number: 1,
          state: WorkflowVersionState.PUBLISHED,
          name: 'Compatible default workflow',
          published_at: new Date(),
        }),
      );
      const definitions = statuses.map((status, index) => ({
        statusId: status.id,
        key: `status_${status.id}`,
        position: status.tabId ?? index,
        isInitial: index === 0,
        isTerminal: status.isTerminal,
      }));
      const transitions = statuses.flatMap((source) =>
        statuses
          .filter((destination) => destination.id !== source.id)
          .map((destination) => ({
            key: `status_${source.id}_to_status_${destination.id}`,
            label: `${source.title} → ${destination.title}`,
            sourceStatusId: source.id,
            destinationStatusId: destination.id,
            allowedRoles: [...TRANSITION_ROLES] as ProjectRole[],
            requirements: { standardFields: [], customFieldIds: [] },
          })),
      );
      await this.replaceDefinition(manager, version, definitions, transitions);
    });
  }

  private async replaceDefinition(
    manager: EntityManager,
    version: ProjectWorkflowVersion,
    statuses: WorkflowStatusDto[],
    transitions: WorkflowTransitionDto[],
  ) {
    await manager.getRepository(ProjectWorkflowStatus).delete({
      version: { id: version.id },
    });
    const statusRepo = manager.getRepository(ProjectWorkflowStatus);
    const saved = await statusRepo.save(
      statuses.map((item) =>
        statusRepo.create({
          version,
          status: { id: item.statusId } as Status,
          key: item.key,
          position: item.position,
          is_initial: item.isInitial,
          is_terminal: item.isTerminal,
        }),
      ),
    );
    const byStatus = new Map(
      saved.map((item, index) => [statuses[index].statusId, item]),
    );
    const transitionRepo = manager.getRepository(ProjectWorkflowTransition);
    await transitionRepo.save(
      transitions.map((item) =>
        transitionRepo.create({
          version,
          source: byStatus.get(item.sourceStatusId),
          destination: byStatus.get(item.destinationStatusId),
          key: item.key,
          label: item.label ?? null,
          allowed_roles: item.allowedRoles,
          requirements: item.requirements ?? null,
        }),
      ),
    );
  }

  private loadWorkflow(
    organizationId: string,
    projectId: number,
    manager?: EntityManager,
  ) {
    return (manager?.getRepository(ProjectWorkflow) ?? this.workflows).findOne({
      where: {
        project: { id: projectId },
        organization: { id: organizationId },
      },
      relations: [
        'versions',
        'versions.statuses',
        'versions.statuses.status',
        'versions.transitions',
        'versions.transitions.source',
        'versions.transitions.source.status',
        'versions.transitions.destination',
        'versions.transitions.destination.status',
      ],
      order: { versions: { version_number: 'DESC' } },
    });
  }

  private loadVersion(id: string, manager: EntityManager) {
    return manager.getRepository(ProjectWorkflowVersion).findOne({
      where: { id },
      relations: [
        'statuses',
        'statuses.status',
        'transitions',
        'transitions.source',
        'transitions.source.status',
        'transitions.destination',
        'transitions.destination.status',
      ],
    });
  }

  private serializeVersion(version?: ProjectWorkflowVersion | null) {
    if (!version) return null;
    return {
      id: version.id,
      version: version.version_number,
      state: version.state,
      name: version.name,
      description: version.description,
      publishedAt: version.published_at,
      statuses: [...(version.statuses ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          id: item.id,
          statusId: item.status.id,
          title: item.status.title,
          color: item.status.color,
          key: item.key,
          position: item.position,
          isInitial: item.is_initial,
          isTerminal: item.is_terminal,
        })),
      transitions: (version.transitions ?? []).map((item) => ({
        id: item.id,
        key: item.key,
        label: item.label,
        sourceStatusId: item.source.status.id,
        destinationStatusId: item.destination.status.id,
        allowedRoles: item.allowed_roles,
        requirements: item.requirements,
      })),
    };
  }
}
