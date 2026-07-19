import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { Note } from 'src/typeorm/entities/Note';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Status } from 'src/typeorm/entities/Status';
import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Whiteboard } from 'src/typeorm/entities/Whiteboard';
import {
  WorkConversion,
  WorkConversionSource,
  WorkConversionTarget,
} from 'src/typeorm/entities/WorkConversion';
import { WorkflowStep } from 'src/typeorm/entities/WorkflowStep';
import { WorkflowTemplate } from 'src/typeorm/entities/WorkflowTemplate';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { OrganizationRole } from 'src/utils/constants/org_roles';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import {
  AssigneeMode,
  ConvertWhiteboardDto,
  CreateWorkflowTemplateDto,
  InstantiateWorkflowDto,
  UpdateWorkflowTemplateDto,
  SaveWorkflowDiagramDto,
  WhiteboardTargetType,
} from './dto/workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly authorization: AuthorizationService,
    @InjectRepository(Whiteboard)
    private readonly boards: Repository<Whiteboard>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Status) private readonly statuses: Repository<Status>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ProjectPeer)
    private readonly projectPeers: Repository<ProjectPeer>,
    @InjectRepository(UserOrganization)
    private readonly organizationMembers: Repository<UserOrganization>,
    @InjectRepository(WorkflowTemplate)
    private readonly templates: Repository<WorkflowTemplate>,
    @InjectRepository(WorkConversion)
    private readonly conversions: Repository<WorkConversion>,
  ) {}

  async convertWhiteboard(
    actor: any,
    org: string,
    projectId: number,
    boardId: string,
    dto: ConvertWhiteboardDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    if (!dto.objects?.length)
      throw new BadRequestException('Select at least one whiteboard object');
    const board = await this.boards.findOne({
      where: [
        { id: boardId, organization_id: org, project: { id: projectId } },
        {
          whiteboardId: boardId,
          organization_id: org,
          project: { id: projectId },
        },
      ],
      relations: ['project'],
    });
    if (!board)
      throw new NotFoundException('Whiteboard not found in this project');
    const elements = new Map(
      (board.elements || []).filter((e) => e?.id).map((e) => [String(e.id), e]),
    );
    const ids = dto.objects.map((item) => item.objectId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException(
        'Each whiteboard object may only be mapped once per batch',
      );
    const missing = ids.filter((id) => !elements.has(id));
    if (missing.length)
      throw new BadRequestException(
        `Whiteboard objects not found: ${missing.join(', ')}`,
      );
    const sourceKeys = ids.map((id) => `${board.id}:${id}`);
    const duplicates = await this.conversions.find({
      where: {
        organization_id: org,
        source_type: WorkConversionSource.WHITEBOARD_OBJECT,
        source_key: In(sourceKeys),
      },
    });
    if (duplicates.length && !dto.confirmDuplicates)
      throw new ConflictException({
        message: 'Some objects were already converted',
        duplicateSourceKeys: duplicates.map((d) => d.source_key),
        confirmationRequired: true,
      });
    const statusIds = dto.objects
      .filter((o) => o.targetType === WhiteboardTargetType.TASK && o.statusId)
      .map((o) => o.statusId!);
    const validStatuses = statusIds.length
      ? await this.statuses.find({
          where: {
            id: In(statusIds),
            organization_id: org,
            project: { id: projectId },
          },
        })
      : [];
    if (
      new Set(validStatuses.map((s) => s.id)).size !== new Set(statusIds).size
    )
      throw new BadRequestException(
        'Every mapped status must belong to the destination project',
      );
    const assigneeIds = dto.objects
      .filter((o) => o.assigneeId)
      .map((o) => o.assigneeId!);
    if (assigneeIds.length)
      await this.validateProjectAssignees(actor, org, projectId, assigneeIds);
    const batchId = randomUUID();
    return this.dataSource.transaction(async (manager) => {
      const claimedDuplicates = await this.claimConversionSources(
        manager,
        org,
        WorkConversionSource.WHITEBOARD_OBJECT,
        sourceKeys,
      );
      if (claimedDuplicates.length && !dto.confirmDuplicates)
        throw new ConflictException({
          message: 'Some objects were already converted',
          duplicateSourceKeys: claimedDuplicates,
          confirmationRequired: true,
        });
      const created: Array<{
        objectId: string;
        targetType: string;
        targetId: string;
      }> = [];
      for (const item of dto.objects) {
        let target: Task | Note;
        if (item.targetType === WhiteboardTargetType.TASK) {
          target = manager.create(Task, {
            title: item.title,
            description: item.description || null,
            due_date: item.dueDate ? new Date(item.dueDate) : null,
            project: { id: projectId } as Project,
            status: item.statusId ? ({ id: item.statusId } as Status) : null,
            user: { id: actor.userId } as User,
            organization_id: org,
            assignees: item.assigneeId ? [{ id: item.assigneeId } as User] : [],
          });
        } else {
          target = manager.create(Note, {
            note: item.description || item.title,
            color: '#FFF3A3',
            is_pinned: false,
            position: null,
            user: { id: actor.userId } as User,
            project: { id: projectId } as Project,
            organization_id: org,
          });
        }
        const saved = await manager.save(target);
        await manager.save(
          manager.create(WorkConversion, {
            organization_id: org,
            source_project_id: projectId,
            destination_project_id: projectId,
            source_type: WorkConversionSource.WHITEBOARD_OBJECT,
            source_key: `${board.id}:${item.objectId}`,
            target_type:
              item.targetType === WhiteboardTargetType.TASK
                ? WorkConversionTarget.TASK
                : WorkConversionTarget.NOTE,
            target_id: String(saved.id),
            batch_id: batchId,
            created_by_id: actor.userId,
            metadata: { whiteboardId: board.whiteboardId },
          }),
        );
        created.push({
          objectId: item.objectId,
          targetType: item.targetType,
          targetId: String(saved.id),
        });
      }
      return { batchId, created };
    });
  }

  async createTemplate(
    actor: any,
    org: string,
    projectId: number,
    dto: CreateWorkflowTemplateDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    if (
      !dto.taskIds?.length ||
      new Set(dto.taskIds).size !== dto.taskIds.length
    )
      throw new BadRequestException(
        'Provide a non-empty ordered list of unique task IDs',
      );
    const tasks = await this.tasks.find({
      where: {
        id: In(dto.taskIds),
        organization_id: org,
        project: { id: projectId },
      },
      relations: ['status', 'assignees', 'project'],
    });
    if (tasks.length !== dto.taskIds.length)
      throw new BadRequestException(
        'Every selected task must belong to the source project',
      );
    if (dto.steps) {
      const stepIds = dto.steps.map((step) => step.taskId);
      if (
        stepIds.length !== dto.taskIds.length ||
        stepIds.some((id, index) => id !== dto.taskIds[index])
      )
        throw new BadRequestException(
          'Workflow step mappings must match the ordered task selection',
        );
    }
    const sourceKey = this.taskSelectionKey(projectId, dto.taskIds);
    const duplicate = await this.conversions.findOne({
      where: {
        organization_id: org,
        source_type: WorkConversionSource.TASK_SELECTION,
        source_key: sourceKey,
      },
    });
    if (duplicate && !dto.confirmDuplicates)
      throw new ConflictException({
        message: 'This task selection was already saved as a workflow',
        confirmationRequired: true,
        existingTemplateId: duplicate.target_id,
      });
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const dated = tasks
      .filter((task) => task.due_date)
      .map((task) => new Date(task.due_date).getTime());
    const baseline = dated.length ? Math.min(...dated) : null;
    const batchId = randomUUID();
    return this.dataSource.transaction(async (manager) => {
      const claimedDuplicates = await this.claimConversionSources(
        manager,
        org,
        WorkConversionSource.TASK_SELECTION,
        [sourceKey],
      );
      if (claimedDuplicates.length && !dto.confirmDuplicates)
        throw new ConflictException({
          message: 'This task selection was already saved as a workflow',
          confirmationRequired: true,
        });
      const template = await manager.save(
        manager.create(WorkflowTemplate, {
          organization_id: org,
          source_project_id: projectId,
          created_by_id: actor.userId,
          name: dto.name,
          description: dto.description || null,
        }),
      );
      const steps = dto.taskIds.map((id, position) => {
        const task = byId.get(id)!;
        const mapping = dto.steps?.[position];
        return manager.create(WorkflowStep, {
          template_id: template.id,
          position,
          source_task_id: task.id,
          title: mapping?.title || task.title,
          description: mapping?.description ?? task.description,
          source_status_title: task.status?.title || null,
          source_assignee_id: task.assignees?.[0]?.id || null,
          source_assignee_ids: (task.assignees ?? []).map(
            (assignee) => assignee.id,
          ),
          due_offset_days:
            task.due_date && baseline !== null
              ? Math.round(
                  (new Date(task.due_date).getTime() - baseline) / 86400000,
                )
              : null,
        });
      });
      await manager.save(steps);
      await manager.save(
        manager.create(WorkConversion, {
          organization_id: org,
          source_project_id: projectId,
          destination_project_id: null,
          source_type: WorkConversionSource.TASK_SELECTION,
          source_key: sourceKey,
          target_type: WorkConversionTarget.WORKFLOW_TEMPLATE,
          target_id: template.id,
          batch_id: batchId,
          created_by_id: actor.userId,
          metadata: { taskIds: dto.taskIds },
        }),
      );
      return { ...template, steps };
    });
  }

  async preview(
    actor: any,
    org: string,
    templateId: string,
    projectId: number,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    const template = await this.getTemplate(org, templateId);
    const statuses = await this.statuses.find({
      where: {
        organization_id: org,
        project: { id: projectId },
        isActive: true,
      },
      order: { id: 'ASC' },
    });
    return {
      template,
      destinationProjectId: projectId,
      statuses: statuses.map((s) => ({
        id: s.id,
        title: s.title,
        color: s.color,
      })),
      steps: template.steps.map((step) => ({
        ...step,
        suggestedStatusId:
          statuses.find(
            (s) =>
              s.title.toLowerCase() === step.source_status_title?.toLowerCase(),
          )?.id || null,
      })),
    };
  }

  async list(actor: any, org: string, projectId?: number) {
    if (projectId) {
      await this.authorization.assertProjectPermission(
        actor,
        org,
        projectId,
        ProjectPermission.EDIT,
      );
    }
    const templates = await this.templates.find({
      where: { organization_id: org },
      relations: ['steps'],
      order: { updated_at: 'DESC', steps: { position: 'ASC' } },
    });
    const projectIds = [
      ...new Set(templates.map((item) => item.source_project_id)),
    ];
    const boardIds = templates
      .map((item) => item.diagram_whiteboard_id)
      .filter((id): id is string => Boolean(id));
    const projects: Project[] = projectIds.length
      ? await this.projects.find({
          where: { id: In(projectIds), organization_id: org },
        })
      : [];
    const boards: Whiteboard[] = boardIds.length
      ? await this.boards.find({
          where: { whiteboardId: In(boardIds), organization_id: org },
        })
      : [];
    const projectsById = new Map<number, Project>(
      projects.map((project) => [project.id, project] as const),
    );
    const boardsById = new Map<string, Whiteboard>(
      boards.map((board) => [board.whiteboardId, board] as const),
    );

    return templates.map((template) => ({
      ...template,
      source_project_title:
        projectsById.get(template.source_project_id)?.title || null,
      diagram_title: template.diagram_whiteboard_id
        ? boardsById.get(template.diagram_whiteboard_id)?.title || null
        : null,
    }));
  }

  async updateTemplate(
    actor: any,
    org: string,
    templateId: string,
    dto: UpdateWorkflowTemplateDto,
  ) {
    const template = await this.getTemplate(org, templateId);
    await this.authorization.assertProjectPermission(
      actor,
      org,
      template.source_project_id,
      ProjectPermission.EDIT,
    );
    if (dto.name !== undefined) template.name = dto.name.trim();
    if (dto.description !== undefined)
      template.description = dto.description.trim() || null;
    return this.templates.save(template);
  }

  async deleteTemplate(actor: any, org: string, templateId: string) {
    const template = await this.getTemplate(org, templateId);
    await this.authorization.assertProjectPermission(
      actor,
      org,
      template.source_project_id,
      ProjectPermission.EDIT,
    );
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        'DELETE claims FROM `work_conversion_claims` claims INNER JOIN `work_conversions` conversions ON conversions.`organization_id` = claims.`organization_id` AND conversions.`source_type` = claims.`source_type` AND conversions.`source_key` = claims.`source_key` WHERE conversions.`organization_id` = ? AND conversions.`source_type` = ? AND conversions.`target_type` = ? AND conversions.`target_id` = ?',
        [
          org,
          WorkConversionSource.TASK_SELECTION,
          WorkConversionTarget.WORKFLOW_TEMPLATE,
          templateId,
        ],
      );
      await manager.delete(WorkConversion, {
        organization_id: org,
        source_type: WorkConversionSource.TASK_SELECTION,
        target_type: WorkConversionTarget.WORKFLOW_TEMPLATE,
        target_id: templateId,
      });
      await manager.remove(template);
    });
    return { success: true, id: templateId };
  }

  async saveDiagram(
    actor: any,
    org: string,
    templateId: string,
    dto: SaveWorkflowDiagramDto,
  ) {
    const template = await this.getTemplate(org, templateId);
    await this.authorization.assertProjectPermission(
      actor,
      org,
      template.source_project_id,
      ProjectPermission.EDIT,
    );
    if (!dto.elements?.length)
      throw new BadRequestException(
        'The workflow diagram must contain elements',
      );
    const invalidElement = dto.elements.find(
      (element) =>
        !element ||
        typeof element.type !== 'string' ||
        typeof element.id !== 'string' ||
        !Number.isFinite(element.x) ||
        !Number.isFinite(element.y),
    );
    if (invalidElement)
      throw new BadRequestException(
        'The workflow diagram contains an invalid Excalidraw element',
      );
    const project = await this.projects.findOne({
      where: { id: template.source_project_id, organization_id: org },
    });
    let board = template.diagram_whiteboard_id
      ? await this.boards.findOne({
          where: {
            whiteboardId: template.diagram_whiteboard_id,
            organization_id: org,
          },
        })
      : null;
    if (!board) {
      const title = this.workflowDiagramTitle(
        project?.title,
        template.name,
        new Date(),
      );
      board = this.boards.create({
        whiteboardId: randomUUID(),
        title,
        description: `Editable diagram generated from the ${template.name} workflow template.`,
        project: { id: template.source_project_id } as Project,
        user: { id: actor.userId } as User,
        lastModifiedBy: { id: actor.userId } as User,
        organization_id: org,
        files: {},
      });
    }
    board.elements = dto.elements;
    board.appState = dto.appState || { viewBackgroundColor: '#ffffff' };
    board.title = this.workflowDiagramTitle(
      project?.title,
      template.name,
      board.created_at || new Date(),
    );
    board.lastModifiedBy = { id: actor.userId } as User;
    const saved = await this.boards.save(board);
    template.diagram_whiteboard_id = saved.whiteboardId;
    await this.templates.save(template);
    return {
      id: saved.id,
      whiteboardId: saved.whiteboardId,
      title: saved.title,
      projectId: template.source_project_id,
    };
  }

  async refreshDiagramTitle(actor: any, org: string, templateId: string) {
    const template = await this.getTemplate(org, templateId);
    await this.authorization.assertProjectPermission(
      actor,
      org,
      template.source_project_id,
      ProjectPermission.EDIT,
    );
    if (!template.diagram_whiteboard_id)
      throw new NotFoundException('Workflow diagram not found');
    const [board, project] = await Promise.all([
      this.boards.findOne({
        where: {
          whiteboardId: template.diagram_whiteboard_id,
          organization_id: org,
        },
      }),
      this.projects.findOne({
        where: { id: template.source_project_id, organization_id: org },
      }),
    ]);
    if (!board) throw new NotFoundException('Workflow diagram not found');
    board.title = this.workflowDiagramTitle(
      project?.title,
      template.name,
      board.created_at || new Date(),
    );
    const saved = await this.boards.save(board);
    return {
      id: saved.id,
      whiteboardId: saved.whiteboardId,
      title: saved.title,
      projectId: template.source_project_id,
    };
  }

  async syncFromSourceProject(actor: any, org: string, templateId: string) {
    const template = await this.getTemplate(org, templateId);
    await this.authorization.assertProjectPermission(
      actor,
      org,
      template.source_project_id,
      ProjectPermission.EDIT,
    );
    const sourceTasks = await this.tasks.find({
      where: {
        organization_id: org,
        project: { id: template.source_project_id },
      },
      relations: ['status', 'assignees'],
      order: { status: { tabId: 'ASC' }, position: 'ASC', id: 'ASC' },
    });
    if (!sourceTasks.length)
      throw new BadRequestException('The source project has no tasks to sync');
    const dated = sourceTasks
      .filter((task) => task.due_date)
      .map((task) => new Date(task.due_date).getTime());
    const baseline = dated.length ? Math.min(...dated) : null;
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(WorkflowStep, { template_id: template.id });
      await manager.save(
        sourceTasks.map((task, position) =>
          manager.create(WorkflowStep, {
            template_id: template.id,
            position,
            source_task_id: task.id,
            title: task.title,
            description: task.description,
            source_status_title: task.status?.title || null,
            source_assignee_id: task.assignees?.[0]?.id || null,
            source_assignee_ids: (task.assignees ?? []).map(
              (assignee) => assignee.id,
            ),
            due_offset_days:
              task.due_date && baseline !== null
                ? Math.round(
                    (new Date(task.due_date).getTime() - baseline) / 86400000,
                  )
                : null,
          }),
        ),
      );
    });
    return this.getTemplate(org, template.id);
  }

  async instantiate(
    actor: any,
    org: string,
    templateId: string,
    dto: InstantiateWorkflowDto,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      org,
      dto.projectId,
      ProjectPermission.EDIT,
    );
    const template = await this.getTemplate(org, templateId);
    const duplicateKey = `${templateId}:${dto.projectId}`;
    const duplicate = await this.conversions.findOne({
      where: {
        organization_id: org,
        source_type: WorkConversionSource.WORKFLOW_STEP,
        source_key: duplicateKey,
      },
    });
    if (duplicate && !dto.confirmDuplicates)
      throw new ConflictException({
        message: 'This workflow was already instantiated in the project',
        confirmationRequired: true,
      });
    const mappings = new Map((dto.steps || []).map((m) => [m.stepId, m]));
    if (
      [...mappings.keys()].some(
        (id) => !template.steps.some((s) => s.id === id),
      )
    )
      throw new BadRequestException(
        'A step mapping does not belong to this workflow',
      );
    const statusIds = [...mappings.values()]
      .filter((m) => m.statusId)
      .map((m) => m.statusId!);
    const statuses = await this.statuses.find({
      where: {
        organization_id: org,
        project: { id: dto.projectId },
        isActive: true,
      },
    });
    if (statusIds.some((id) => !statuses.some((s) => s.id === id)))
      throw new BadRequestException(
        'Every mapped status must belong to the destination project',
      );
    const retainedIds =
      dto.assigneeMode === AssigneeMode.RETAIN
        ? template.steps.flatMap((step) => this.sourceAssigneeIds(step))
        : [];
    const allowedAssignees = retainedIds.length
      ? await this.validateProjectAssignees(
          actor,
          org,
          dto.projectId,
          retainedIds,
          false,
        )
      : new Set<number>();
    const start = dto.startDate ? new Date(dto.startDate) : new Date();
    if (Number.isNaN(start.getTime()))
      throw new BadRequestException('Invalid workflow start date');
    const batchId = randomUUID();
    return this.dataSource.transaction(async (manager) => {
      const claimedDuplicates = await this.claimConversionSources(
        manager,
        org,
        WorkConversionSource.WORKFLOW_STEP,
        [duplicateKey],
      );
      if (claimedDuplicates.length && !dto.confirmDuplicates)
        throw new ConflictException({
          message: 'This workflow was already instantiated in the project',
          confirmationRequired: true,
        });
      const created = [];
      for (const step of template.steps) {
        const map = mappings.get(step.id);
        const matched = statuses.find(
          (s) =>
            s.title.toLowerCase() === step.source_status_title?.toLowerCase(),
        );
        const due =
          step.due_offset_days == null
            ? null
            : new Date(start.getTime() + step.due_offset_days * 86400000);
        const assigneeIds =
          dto.assigneeMode === AssigneeMode.RETAIN
            ? this.sourceAssigneeIds(step).filter((id) =>
                allowedAssignees.has(id),
              )
            : [];
        const task = await manager.save(
          manager.create(Task, {
            title: map?.title || step.title,
            description: map?.description ?? step.description,
            due_date: due,
            project: { id: dto.projectId } as Project,
            status:
              map?.statusId || matched?.id
                ? ({ id: map?.statusId || matched!.id } as Status)
                : null,
            user: { id: actor.userId } as User,
            organization_id: org,
            assignees: assigneeIds.map((id) => ({ id }) as User),
          }),
        );
        created.push(task);
      }
      await manager.save(
        manager.create(WorkConversion, {
          organization_id: org,
          source_project_id: template.source_project_id,
          destination_project_id: dto.projectId,
          source_type: WorkConversionSource.WORKFLOW_STEP,
          source_key: duplicateKey,
          target_type: WorkConversionTarget.TASK,
          target_id: String(created[0].id),
          batch_id: batchId,
          created_by_id: actor.userId,
          metadata: { templateId, taskIds: created.map((task) => task.id) },
        }),
      );
      return { batchId, tasks: created };
    });
  }

  private async getTemplate(org: string, id: string) {
    const template = await this.templates.findOne({
      where: { id, organization_id: org },
      relations: ['steps'],
      order: { steps: { position: 'ASC' } },
    });
    if (!template) throw new NotFoundException('Workflow template not found');
    return template;
  }
  private workflowDiagramTitle(
    projectTitle: string | null | undefined,
    workflowName: string,
    date: Date,
  ) {
    const compactProject = (projectTitle?.trim() || 'Project').slice(0, 28);
    const compactWorkflow = workflowName.trim().slice(0, 180);
    const dateLabel = date.toISOString().slice(0, 10);
    return `${compactProject} — ${compactWorkflow} — ${dateLabel}`;
  }
  private taskSelectionKey(projectId: number, ids: number[]) {
    return `${projectId}:${[...ids].sort((a, b) => a - b).join(',')}`;
  }
  private async claimConversionSources(
    manager: EntityManager,
    org: string,
    sourceType: WorkConversionSource,
    sourceKeys: string[],
  ): Promise<string[]> {
    const duplicates: string[] = [];
    for (const sourceKey of [...sourceKeys].sort()) {
      const result = await manager.query(
        'INSERT IGNORE INTO `work_conversion_claims` (`organization_id`, `source_type`, `source_key`) VALUES (?, ?, ?)',
        [org, sourceType, sourceKey],
      );
      if (Number(result?.affectedRows ?? 0) === 0) duplicates.push(sourceKey);
    }
    return duplicates;
  }
  private sourceAssigneeIds(step: WorkflowStep): number[] {
    if (Array.isArray(step.source_assignee_ids)) {
      return [...new Set(step.source_assignee_ids.filter(Number.isInteger))];
    }
    return step.source_assignee_id ? [step.source_assignee_id] : [];
  }
  private async validateProjectAssignees(
    actor: any,
    org: string,
    projectId: number,
    ids: number[],
    strict = true,
  ) {
    const unique = [...new Set(ids)];
    const [project, peers, admins] = await Promise.all([
      this.projects.findOne({
        where: { id: projectId, organization_id: org },
        relations: ['user'],
      }),
      this.projectPeers.find({
        where: {
          project: { id: projectId },
          user: { id: In(unique) },
          organization_id: org,
          status: ProjectPeerStatus.CONNECTED,
          is_confirmed: true,
        },
        relations: ['user'],
      }),
      this.organizationMembers.find({
        where: {
          organization_id: org,
          user_id: In(unique),
          role: OrganizationRole.ORG_ADMIN,
          is_active: true,
        },
      }),
    ]);
    const allowed = new Set<number>([
      ...(project?.user?.id ? [Number(project.user.id)] : []),
      ...peers.map((peer) => Number(peer.user.id)),
      ...admins.map((member) => Number(member.user_id)),
    ]);
    const invalid = unique.filter((id) => !allowed.has(id));
    if (strict && invalid.length)
      throw new BadRequestException(
        `Assignee ${invalid[0]} is not a project member`,
      );
    return allowed;
  }
}
