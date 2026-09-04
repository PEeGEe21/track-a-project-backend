import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { TaskDependency } from 'src/typeorm/entities/TaskDependency';
import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';
import { AuthUser } from 'src/types/users';
import { DataSource, In, Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { AuditWriterService } from 'src/audit/audit-writer.service';
import {
  AuditAction,
  AuditActorType,
  AuditSource,
  AuditSubjectType,
} from 'src/audit/audit-contract';
import { ProjectActivitiesService } from 'src/project-activities/services/project-activities.service';
import { ActivityType } from 'src/utils/constants/activity';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';

@Injectable()
export class TaskDependenciesService {
  constructor(
    @InjectRepository(TaskDependency)
    private readonly dependencies: Repository<TaskDependency>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly authorization: AuthorizationService,
    private readonly dataSource: DataSource,
    private readonly auditWriter: AuditWriterService,
    private readonly activities: ProjectActivitiesService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async auditEnabled(actor: AuthUser, organizationId: string) {
    const resolved = await this.entitlements.resolveForActor(
      actor,
      organizationId,
    );
    return Boolean(
      resolved.find((item) => item.key === CapabilityKey.ADVANCED_AUDIT_TRAIL)
        ?.enabled,
    );
  }

  private async actor(userId: number) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private auditActor(user: User) {
    return {
      type: AuditActorType.HUMAN,
      id: user.id,
      label: user.fullName || user.email || `User ${user.id}`,
    };
  }

  private async task(taskId: number, organizationId: string) {
    const task = await this.tasks.findOne({
      where: { id: taskId, organization_id: organizationId },
      relations: ['project', 'status'],
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async assertPermission(
    task: Task,
    actor: AuthUser,
    organizationId: string,
    permission: ProjectPermission,
  ) {
    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      task.project.id,
      permission,
    );
  }

  async list(taskId: number, actor: AuthUser, organizationId: string) {
    const task = await this.task(taskId, organizationId);
    await this.assertPermission(
      task,
      actor,
      organizationId,
      ProjectPermission.VIEW,
    );
    const edges = await this.dependencies.find({
      where: [
        { organization_id: organizationId, task_id: taskId },
        { organization_id: organizationId, depends_on_task_id: taskId },
      ],
      order: { created_at: 'DESC' },
    });
    const serialized = await Promise.all(
      edges.map(async (edge) => {
        const otherId =
          edge.task_id === taskId ? edge.depends_on_task_id : edge.task_id;
        const other = await this.tasks.findOne({
          where: { id: otherId, organization_id: organizationId },
          relations: ['project', 'status'],
        });
        let visible = false;
        if (other) {
          try {
            await this.assertPermission(
              other,
              actor,
              organizationId,
              ProjectPermission.VIEW,
            );
            visible = true;
          } catch {
            /* Deliberately redact inaccessible dependency details. */
          }
        }
        return {
          id: edge.id,
          direction: edge.task_id === taskId ? 'blocked_by' : 'blocks',
          active: edge.active,
          created_at: edge.created_at,
          removed_at: edge.active ? null : edge.updated_at,
          task:
            visible && other
              ? {
                  id: other.id,
                  title: other.title,
                  projectId: other.project.id,
                  status: other.status,
                }
              : null,
          inaccessible: !visible,
        };
      }),
    );
    return { success: true, data: serialized };
  }

  private async introducesCycle(
    taskId: number,
    dependsOnTaskId: number,
    organizationId: string,
  ) {
    const edges = await this.dependencies.findBy({
      organization_id: organizationId,
      active: true,
    });
    const graph = new Map<number, number[]>();
    for (const edge of edges)
      graph.set(edge.task_id, [
        ...(graph.get(edge.task_id) ?? []),
        edge.depends_on_task_id,
      ]);
    graph.set(taskId, [...(graph.get(taskId) ?? []), dependsOnTaskId]);
    const stack = [dependsOnTaskId];
    const seen = new Set<number>();
    while (stack.length) {
      const node = stack.pop()!;
      if (node === taskId) return true;
      if (seen.has(node)) continue;
      seen.add(node);
      stack.push(...(graph.get(node) ?? []));
    }
    return false;
  }

  async create(
    taskId: number,
    dependsOnTaskId: number,
    actor: AuthUser,
    organizationId: string,
  ) {
    if (taskId === dependsOnTaskId)
      throw new BadRequestException('A task cannot depend on itself');
    const [task, prerequisite] = await Promise.all([
      this.task(taskId, organizationId),
      this.task(dependsOnTaskId, organizationId),
    ]);
    await this.assertPermission(
      task,
      actor,
      organizationId,
      ProjectPermission.CONTRIBUTE,
    );
    await this.assertPermission(
      prerequisite,
      actor,
      organizationId,
      ProjectPermission.VIEW,
    );
    if (await this.introducesCycle(taskId, dependsOnTaskId, organizationId)) {
      throw new ConflictException(
        'This dependency would create a circular dependency',
      );
    }
    const existing = await this.dependencies.findOneBy({
      organization_id: organizationId,
      task_id: taskId,
      depends_on_task_id: dependsOnTaskId,
    });
    if (existing?.active)
      throw new ConflictException('Dependency already exists');
    const edge =
      existing ??
      this.dependencies.create({
        organization_id: organizationId,
        task_id: taskId,
        depends_on_task_id: dependsOnTaskId,
      });
    Object.assign(edge, {
      task_title_snapshot: task.title,
      depends_on_title_snapshot: prerequisite.title,
      created_by_user_id: actor.userId,
      removed_by_user_id: null,
      removal_reason: null,
      active: true,
    });
    const user = await this.actor(actor.userId);
    const auditEnabled = await this.auditEnabled(actor, organizationId);
    const saved = await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(TaskDependency).save(edge);
      if (auditEnabled)
        await this.auditWriter.append(manager, {
          organizationId,
          projectId: task.project.id,
          action: AuditAction.TASK_DEPENDENCY_CREATED,
          actor: this.auditActor(user),
          subject: {
            type: AuditSubjectType.TASK_DEPENDENCY,
            id: result.id,
            label: `${task.title} blocked by ${prerequisite.title}`,
          },
          source: AuditSource.API,
          correlationId: this.auditWriter.correlationId(),
          after: {
            task_id: task.id,
            depends_on_task_id: prerequisite.id,
            active: true,
          },
        });
      return result;
    });
    await this.activities.createActivity({
      organization_id: organizationId,
      projectId: task.project.id,
      userId: user.id,
      activityType: ActivityType.TASK_UPDATED,
      description: `${user.fullName} added a blocker to ${task.title}`,
      entityType: 'task_dependency',
      entityId: task.id,
      metadata: { dependencyId: saved.id, dependsOnTaskId },
    });
    return {
      success: true,
      message: 'Dependency added',
      data: saved,
    };
  }

  async remove(
    taskId: number,
    dependencyId: string,
    actor: AuthUser,
    organizationId: string,
  ) {
    const task = await this.task(taskId, organizationId);
    await this.assertPermission(
      task,
      actor,
      organizationId,
      ProjectPermission.CONTRIBUTE,
    );
    const edge = await this.dependencies.findOneBy({
      id: dependencyId,
      organization_id: organizationId,
      task_id: taskId,
      active: true,
    });
    if (!edge) throw new NotFoundException('Dependency not found');
    const user = await this.actor(actor.userId);
    const auditEnabled = await this.auditEnabled(actor, organizationId);
    await this.dataSource.transaction(async (manager) => {
      edge.active = false;
      edge.removed_by_user_id = actor.userId;
      edge.removal_reason = 'removed';
      await manager.getRepository(TaskDependency).save(edge);
      if (auditEnabled)
        await this.auditWriter.append(manager, {
          organizationId,
          projectId: task.project.id,
          action: AuditAction.TASK_DEPENDENCY_REMOVED,
          actor: this.auditActor(user),
          subject: {
            type: AuditSubjectType.TASK_DEPENDENCY,
            id: edge.id,
            label: `${edge.task_title_snapshot} blocked by ${edge.depends_on_title_snapshot}`,
          },
          source: AuditSource.API,
          correlationId: this.auditWriter.correlationId(),
          before: { active: true },
          after: { active: false, removal_reason: 'removed' },
        });
    });
    await this.activities.createActivity({
      organization_id: organizationId,
      projectId: task.project.id,
      userId: user.id,
      activityType: ActivityType.TASK_UPDATED,
      description: `${user.fullName} removed a blocker from ${task.title}`,
      entityType: 'task_dependency',
      entityId: task.id,
      metadata: { dependencyId: edge.id },
    });
    return {
      success: true,
      message: 'Dependency removed',
      data: { id: edge.id },
    };
  }

  async warnings(taskId: number, actor: AuthUser, organizationId: string) {
    const task = await this.task(taskId, organizationId);
    await this.assertPermission(
      task,
      actor,
      organizationId,
      ProjectPermission.VIEW,
    );
    const edges = await this.dependencies.findBy({
      organization_id: organizationId,
      task_id: taskId,
      active: true,
    });
    const blockers = await Promise.all(
      edges.map((edge) =>
        this.tasks.findOne({
          where: {
            id: edge.depends_on_task_id,
            organization_id: organizationId,
          },
          relations: ['project', 'status'],
        }),
      ),
    );
    const unresolved = blockers.filter(
      (item) => item && !item.status?.isTerminal,
    );
    return {
      success: true,
      data: {
        hasConflicts: unresolved.length > 0,
        unresolvedCount: unresolved.length,
      },
    };
  }

  private tokenSecret() {
    return process.env.JWT_ACCESS_TOKEN_SECRET!;
  }

  private signPreview(payload: Record<string, unknown>) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.tokenSecret())
      .update(body)
      .digest('base64url');
    return `${body}.${signature}`;
  }

  private verifyPreview(token: string) {
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra)
      throw new BadRequestException('Invalid preview token');
    const expected = createHmac('sha256', this.tokenSecret())
      .update(body)
      .digest();
    const provided = Buffer.from(signature, 'base64url');
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    )
      throw new BadRequestException('Invalid preview token');
    try {
      return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid preview token');
    }
  }

  async previewDates(
    taskId: number,
    dueDate: string,
    actor: AuthUser,
    organizationId: string,
  ) {
    const root = await this.task(taskId, organizationId);
    await this.assertPermission(
      root,
      actor,
      organizationId,
      ProjectPermission.CONTRIBUTE,
    );
    const requested = new Date(dueDate);
    if (Number.isNaN(requested.getTime()))
      throw new BadRequestException('Invalid due date');
    const edges = await this.dependencies.findBy({
      organization_id: organizationId,
      active: true,
    });
    const downstream = new Map<number, number[]>();
    for (const edge of edges)
      downstream.set(edge.depends_on_task_id, [
        ...(downstream.get(edge.depends_on_task_id) ?? []),
        edge.task_id,
      ]);
    const reachable = new Set<number>([taskId]);
    const queue = [taskId];
    while (queue.length) {
      for (const child of downstream.get(queue.shift()!) ?? []) {
        if (!reachable.has(child)) {
          reachable.add(child);
          queue.push(child);
        }
      }
    }
    const tasks = await this.tasks.find({
      where: { id: In([...reachable]), organization_id: organizationId },
      relations: ['project', 'status'],
    });
    const byId = new Map(tasks.map((item) => [item.id, item]));
    const proposed = new Map<number, Date>([[taskId, requested]]);
    const walk = [taskId];
    while (walk.length) {
      const parentId = walk.shift()!;
      const parentDate = proposed.get(parentId) ?? byId.get(parentId)?.due_date;
      if (!parentDate) continue;
      for (const childId of downstream.get(parentId) ?? []) {
        const child = byId.get(childId);
        if (!child) continue;
        const minimum = new Date(parentDate);
        minimum.setUTCDate(minimum.getUTCDate() + 1);
        const currentProposal = proposed.get(childId) ?? child.due_date;
        if (!currentProposal || currentProposal < minimum) {
          proposed.set(childId, minimum);
          walk.push(childId);
        }
      }
    }
    const changes = [...proposed.entries()]
      .map(([id, after]) => ({
        id,
        before: byId.get(id)?.due_date?.toISOString() ?? null,
        after: after.toISOString(),
        title: byId.get(id)?.title ?? '',
      }))
      .filter((change) => change.before !== change.after);
    for (const change of changes) {
      const affected = byId.get(change.id);
      if (!affected) throw new ConflictException('Dependency graph changed');
      await this.assertPermission(
        affected,
        actor,
        organizationId,
        ProjectPermission.CONTRIBUTE,
      );
    }
    const expiresAt = Date.now() + 10 * 60 * 1000;
    return {
      success: true,
      data: {
        changes,
        expiresAt: new Date(expiresAt).toISOString(),
        previewToken: this.signPreview({
          taskId,
          organizationId,
          userId: actor.userId,
          changes,
          expiresAt,
        }),
      },
    };
  }

  async applyDates(
    taskId: number,
    previewToken: string,
    actor: AuthUser,
    organizationId: string,
  ) {
    const preview = this.verifyPreview(previewToken);
    if (
      preview.taskId !== taskId ||
      preview.organizationId !== organizationId ||
      preview.userId !== actor.userId ||
      preview.expiresAt < Date.now() ||
      !Array.isArray(preview.changes)
    )
      throw new ConflictException('Preview is expired or does not match');
    const ids = preview.changes.map((change) => Number(change.id));
    const tasks = await this.tasks.find({
      where: { id: In(ids), organization_id: organizationId },
      relations: ['project', 'status'],
    });
    const byId = new Map(tasks.map((item) => [item.id, item]));
    for (const change of preview.changes) {
      const task = byId.get(Number(change.id));
      if (!task || (task.due_date?.toISOString() ?? null) !== change.before)
        throw new ConflictException(
          'Task dates changed after preview; create a new preview',
        );
      await this.assertPermission(
        task,
        actor,
        organizationId,
        ProjectPermission.CONTRIBUTE,
      );
    }
    const user = await this.actor(actor.userId);
    const auditEnabled = await this.auditEnabled(actor, organizationId);
    await this.dataSource.transaction(async (manager) => {
      for (const change of preview.changes) {
        await manager
          .getRepository(Task)
          .update(
            { id: Number(change.id), organization_id: organizationId },
            { due_date: new Date(change.after) },
          );
      }
      const root = byId.get(taskId);
      if (auditEnabled)
        await this.auditWriter.append(manager, {
          organizationId,
          projectId: root?.project.id,
          action: AuditAction.TASK_DEPENDENCY_DATES_APPLIED,
          actor: this.auditActor(user),
          subject: {
            type: AuditSubjectType.TASK_DEPENDENCY,
            id: taskId,
            label: root?.title,
          },
          source: AuditSource.API,
          correlationId: this.auditWriter.correlationId(),
          metadata: { changes: preview.changes },
        });
    });
    return {
      success: true,
      message: `Updated ${preview.changes.length} task date(s)`,
      data: { updated: preview.changes.length },
    };
  }
}
