import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { Project } from 'src/typeorm/entities/Project';
import {
  ReusableTemplate,
  ReusableTemplateType,
} from 'src/typeorm/entities/ReusableTemplate';
import { ReusableTemplateVersion } from 'src/typeorm/entities/ReusableTemplateVersion';
import { Status } from 'src/typeorm/entities/Status';
import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';
import { AuthUser } from 'src/types/users';
import { ProjectStatus } from 'src/utils/constants/project';
import { DataSource, IsNull } from 'typeorm';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { AuditWriterService } from 'src/audit/audit-writer.service';
import {
  AuditAction,
  AuditActorType,
  AuditSource,
  AuditSubjectType,
} from 'src/audit/audit-contract';
import {
  CreateTemplateDto,
  CreateTemplateVersionDto,
  InstantiateTemplateDto,
} from './dto/template.dto';
@Injectable()
export class TemplatesService {
  constructor(
    private ds: DataSource,
    private auth: AuthorizationService,
    private entitlements: EntitlementsService,
    private auditWriter: AuditWriterService,
  ) {}
  private async auditEnabled(actor: AuthUser, org: string) {
    return Boolean(
      (await this.entitlements.resolveForActor(actor, org)).find(
        (item) => item.key === CapabilityKey.ADVANCED_AUDIT_TRAIL,
      )?.enabled,
    );
  }
  async list(actor: AuthUser, org: string) {
    await this.auth.getProjectAccessScope(actor, org);
    const rows = await this.ds.getRepository(ReusableTemplate).find({
      where: { organization_id: org, archived_at: IsNull() },
      relations: ['versions'],
      order: { updated_at: 'DESC' },
    });
    return { success: true, data: rows.map((x) => this.serialize(x)) };
  }
  async create(
    actor: AuthUser,
    org: string,
    projectId: number,
    dto: CreateTemplateDto,
  ) {
    await this.auth.assertProjectPermission(
      actor,
      org,
      projectId,
      ProjectPermission.EDIT,
    );
    this.validate(dto.type, dto.snapshot);
    const auditEnabled = await this.auditEnabled(actor, org);
    const id = await this.ds.transaction(async (m) => {
      const r = m.getRepository(ReusableTemplate);
      const t = await r.save(
        r.create({
          organization_id: org,
          source_project_id: projectId,
          type: dto.type,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          created_by_id: actor.userId,
        }),
      );
      const version = await m.getRepository(ReusableTemplateVersion).save({
        template_id: t.id,
        version_number: 1,
        snapshot: dto.snapshot,
        created_by_id: actor.userId,
      });
      if (auditEnabled)
        await this.auditWriter.append(m, {
          organizationId: org,
          projectId,
          action: AuditAction.TEMPLATE_CREATED,
          actor: {
            type: AuditActorType.HUMAN,
            id: actor.userId,
            label: `User ${actor.userId}`,
          },
          subject: { type: AuditSubjectType.TEMPLATE, id: t.id, label: t.name },
          source: AuditSource.API,
          correlationId: this.auditWriter.correlationId(),
          after: {
            name: t.name,
            status: 'active',
            version: version.version_number,
            template_type: t.type,
          },
        });
      return t.id;
    });
    return this.get(actor, org, id);
  }
  async version(
    actor: AuthUser,
    org: string,
    id: string,
    dto: CreateTemplateVersionDto,
  ) {
    const t = await this.scoped(org, id);
    if (!t.source_project_id)
      throw new BadRequestException('Template source project is unavailable');
    await this.auth.assertProjectPermission(
      actor,
      org,
      t.source_project_id,
      ProjectPermission.EDIT,
    );
    this.validate(t.type, dto.snapshot);
    const n = Math.max(...t.versions.map((v) => v.version_number)) + 1;
    const auditEnabled = await this.auditEnabled(actor, org);
    await this.ds.transaction(async (manager) => {
      await manager.getRepository(ReusableTemplateVersion).save({
        template_id: id,
        version_number: n,
        snapshot: dto.snapshot,
        created_by_id: actor.userId,
      });
      if (auditEnabled)
        await this.auditWriter.append(manager, {
          organizationId: org,
          projectId: t.source_project_id,
          action: AuditAction.TEMPLATE_UPDATED,
          actor: {
            type: AuditActorType.HUMAN,
            id: actor.userId,
            label: `User ${actor.userId}`,
          },
          subject: { type: AuditSubjectType.TEMPLATE, id: t.id, label: t.name },
          source: AuditSource.API,
          correlationId: this.auditWriter.correlationId(),
          before: { version: n - 1 },
          after: {
            name: t.name,
            status: 'active',
            version: n,
            template_type: t.type,
          },
        });
    });
    return this.get(actor, org, id);
  }
  async get(actor: AuthUser, org: string, id: string) {
    await this.auth.getProjectAccessScope(actor, org);
    return { success: true, data: this.serialize(await this.scoped(org, id)) };
  }
  async preview(
    actor: AuthUser,
    org: string,
    id: string,
    dto: InstantiateTemplateDto,
  ) {
    const t = await this.scoped(org, id);
    const v = this.latest(t);
    const target =
      t.type === ReusableTemplateType.PROJECT ? undefined : dto.targetProjectId;
    if (t.type !== ReusableTemplateType.PROJECT && !target)
      throw new BadRequestException('Target project is required');
    let statuses: Status[] = [];
    if (target) {
      await this.auth.assertProjectPermission(
        actor,
        org,
        target,
        ProjectPermission.CONTRIBUTE,
      );
      statuses = await this.ds
        .getRepository(Status)
        .find({ where: { project: { id: target } } });
    }
    const required = this.statusKeys(t.type, v.snapshot);
    const missing = required.filter((k) => {
      if (t.type === ReusableTemplateType.PROJECT) return false;
      const mappedStatusId = dto.statusMappings?.[k];
      const hasValidMapping =
        mappedStatusId !== undefined &&
        statuses.some((status) => status.id === Number(mappedStatusId));
      return (
        !hasValidMapping &&
        !statuses.some((s) => s.title.toLowerCase() === k.toLowerCase())
      );
    });
    return {
      success: true,
      data: {
        templateId: id,
        version: v.version_number,
        type: t.type,
        objects:
          t.type === ReusableTemplateType.PROJECT
            ? 1 + ((v.snapshot.tasks as any[])?.length ?? 0)
            : t.type === ReusableTemplateType.CHECKLIST
              ? (v.snapshot.items as any[])?.length ?? 0
              : 1,
        missingStatusMappings: missing,
        compatible: missing.length === 0,
        snapshot: v.snapshot,
      },
    };
  }
  async instantiate(
    actor: AuthUser,
    org: string,
    id: string,
    dto: InstantiateTemplateDto,
  ) {
    const t = await this.scoped(org, id);
    const preview = await this.preview(actor, org, id, dto);
    if (!preview.data.compatible)
      throw new BadRequestException({
        message: 'Template requires status remapping',
        statuses: preview.data.missingStatusMappings,
      });
    const snapshot = this.latest(t).snapshot as any;
    const start = dto.startDate
      ? new Date(`${dto.startDate}T00:00:00Z`)
      : new Date();
    const result = await this.ds.transaction(async (m) => {
      let projectId = dto.targetProjectId;
      let statusMap = new Map<string, number>();
      if (t.type === ReusableTemplateType.PROJECT) {
        const p = await m.getRepository(Project).save({
          title: dto.projectTitle?.trim() || snapshot.title,
          description: snapshot.description || '',
          description_html: null,
          color: snapshot.color || null,
          icon: snapshot.icon || null,
          status: ProjectStatus.ACTIVE,
          user: { id: actor.userId } as User,
          organization_id: org,
        });
        projectId = p.id;
        for (const [i, s] of (
          snapshot.statuses ?? [{ key: 'todo', title: 'To Do' }]
        ).entries()) {
          const saved = await m.getRepository(Status).save({
            title: s.title,
            color: s.color || '#94A3B8',
            tabId: i,
            isActive: true,
            isDefault: i === 0,
            isTerminal: Boolean(s.isTerminal),
            project: { id: p.id } as Project,
            user: { id: actor.userId } as User,
            organization_id: org,
          });
          statusMap.set(s.key, saved.id);
        }
      } else {
        const statuses = await m
          .getRepository(Status)
          .find({ where: { project: { id: projectId! } } });
        for (const key of this.statusKeys(t.type, snapshot)) {
          const mappedStatusId = dto.statusMappings?.[key];
          const id =
            statuses.find((status) => status.id === Number(mappedStatusId))
              ?.id ??
            statuses.find((s) => s.title.toLowerCase() === key.toLowerCase())
              ?.id;
          if (id) statusMap.set(key, id);
        }
      }
      const definitions =
        t.type === ReusableTemplateType.TASK
          ? [snapshot]
          : t.type === ReusableTemplateType.CHECKLIST
            ? snapshot.items ?? []
            : snapshot.tasks ?? [];
      const taskIds = [];
      for (const item of definitions) {
        const due =
          item.dueOffsetDays === undefined
            ? null
            : new Date(start.getTime() + Number(item.dueOffsetDays) * 86400000);
        const statusId =
          statusMap.get(item.statusKey) || [...statusMap.values()][0];
        if (!statusId)
          throw new BadRequestException('Template task status is unresolved');
        const task = await m.getRepository(Task).save({
          title: item.title,
          description: item.description || '',
          description_html: null,
          priority: item.priority ?? 0,
          severity: item.severity ?? null,
          due_date: due,
          organization_id: org,
          project: { id: projectId! } as Project,
          status: { id: statusId } as Status,
          user: { id: actor.userId } as User,
          assignees: [],
        });
        taskIds.push(task.id);
      }
      return { projectId, taskIds };
    });
    return { success: true, message: 'Template instantiated', data: result };
  }
  private async scoped(org: string, id: string) {
    const t = await this.ds.getRepository(ReusableTemplate).findOne({
      where: { id, organization_id: org, archived_at: IsNull() },
      relations: ['versions'],
    });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }
  private latest(t: ReusableTemplate) {
    return [...t.versions].sort(
      (a, b) => b.version_number - a.version_number,
    )[0];
  }
  private validate(type: ReusableTemplateType, s: any) {
    if (!s || typeof s !== 'object')
      throw new BadRequestException('Template snapshot is required');
    if (
      type === ReusableTemplateType.TASK &&
      (typeof s.title !== 'string' || !s.title.trim())
    )
      throw new BadRequestException('Task template requires a title');
    if (
      type === ReusableTemplateType.CHECKLIST &&
      (!Array.isArray(s.items) || !s.items.length)
    )
      throw new BadRequestException('Checklist template requires items');
    const definitions =
      type === ReusableTemplateType.TASK
        ? [s]
        : type === ReusableTemplateType.CHECKLIST
          ? s.items
          : s.tasks;
    if (
      Array.isArray(definitions) &&
      definitions.some(
        (item: any) =>
          !item || typeof item.title !== 'string' || !item.title.trim(),
      )
    )
      throw new BadRequestException('Every template task requires a title');
    if (
      type === ReusableTemplateType.PROJECT &&
      (typeof s.title !== 'string' || !Array.isArray(s.tasks))
    )
      throw new BadRequestException(
        'Project template requires title and tasks',
      );
  }
  private statusKeys(type: ReusableTemplateType, s: any) {
    const items =
      type === ReusableTemplateType.TASK
        ? [s]
        : type === ReusableTemplateType.CHECKLIST
          ? s.items ?? []
          : s.tasks ?? [];
    return [
      ...new Set(items.map((x: any) => x.statusKey || 'To Do')),
    ] as string[];
  }
  private serialize(t: ReusableTemplate) {
    const v = this.latest(t);
    return {
      id: t.id,
      type: t.type,
      name: t.name,
      description: t.description,
      sourceProjectId: t.source_project_id,
      version: v?.version_number,
      snapshot: v?.snapshot,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  }
}
