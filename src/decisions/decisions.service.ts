import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { ProjectRolePolicy } from 'src/common/authorization/project-role.policy';
import { Decision, DecisionStatus } from 'src/typeorm/entities/Decision';
import { DecisionHistory } from 'src/typeorm/entities/DecisionHistory';
import {
  DecisionLink,
  DecisionLinkType,
} from 'src/typeorm/entities/DecisionLink';
import { Document } from 'src/typeorm/entities/Document';
import { Note } from 'src/typeorm/entities/Note';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { DecisionLinkDto, SaveDecisionDto } from './dto/decision.dto';
import { DataLifecycleService } from 'src/data-lifecycle/data-lifecycle.service';
import { LifecycleRecordType } from 'src/typeorm/entities/DataLifecycleEvent';

type Access = {
  user: User;
  project: Project;
  isOwner: boolean;
  role: ProjectRole;
  canContribute: boolean;
  canManage: boolean;
};

@Injectable()
export class DecisionsService {
  constructor(
    @InjectRepository(Decision)
    private readonly decisions: Repository<Decision>,
    @InjectRepository(DecisionLink)
    private readonly links: Repository<DecisionLink>,
    @InjectRepository(DecisionHistory)
    private readonly histories: Repository<DecisionHistory>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectPeer)
    private readonly peers: Repository<ProjectPeer>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    @InjectRepository(ProjectComment)
    private readonly messages: Repository<ProjectComment>,
    @InjectRepository(Note) private readonly notes: Repository<Note>,
    private readonly lifecycle: DataLifecycleService,
  ) {}

  async list(
    actor: any,
    org: string,
    projectId: number,
    filters: { status?: string; ownerId?: number; from?: string; to?: string },
    page = 1,
    limit = 10,
  ) {
    const access = await this.access(actor, org, projectId);
    const where: FindOptionsWhere<Decision> = {
      organization_id: org,
      project_id: projectId,
    };
    const publicStatuses = [
      DecisionStatus.ACCEPTED,
      DecisionStatus.REJECTED,
      DecisionStatus.SUPERSEDED,
    ];
    let queryWhere: FindOptionsWhere<Decision> | FindOptionsWhere<Decision>[] =
      where;
    if (
      filters.status &&
      Object.values(DecisionStatus).includes(filters.status as DecisionStatus)
    ) {
      if (filters.status === DecisionStatus.PROPOSED && !access.canContribute)
        throw new ForbiddenException(
          'Viewer access does not include proposed decisions',
        );
      where.status = filters.status as DecisionStatus;
      if (filters.status === DecisionStatus.PROPOSED && !access.canManage)
        where.created_by_id = access.user.id;
    } else if (access.canManage)
      where.status = In(Object.values(DecisionStatus));
    else if (!access.canContribute) where.status = In(publicStatuses);
    if (filters.ownerId) where.owner_id = Number(filters.ownerId);
    if (filters.from && filters.to)
      where.decision_date = Between(filters.from, filters.to);
    else if (filters.from) where.decision_date = MoreThanOrEqual(filters.from);
    else if (filters.to) where.decision_date = LessThanOrEqual(filters.to);
    if (!filters.status && access.canContribute && !access.canManage)
      queryWhere = [
        { ...where, status: In(publicStatuses) },
        {
          ...where,
          status: DecisionStatus.PROPOSED,
          created_by_id: access.user.id,
        },
      ];
    const pagination = this.pagination(page, limit);
    const [data, total] = await this.decisions.findAndCount({
      where: queryWhere,
      relations: ['owner', 'created_by', 'links', 'supersedes'],
      order: { decision_date: 'DESC', created_at: 'DESC' },
      skip: pagination.skip,
      take: pagination.limit,
    });
    return { data, meta: this.meta(pagination, total, data.length) };
  }

  async referenceOptions(
    actor: any,
    org: string,
    projectId: number,
    type: DecisionLinkType,
    search = '',
    page = 1,
    limit = 20,
  ) {
    const access = await this.access(actor, org, projectId);
    if (!Object.values(DecisionLinkType).includes(type))
      throw new BadRequestException('Invalid decision link type');
    const pagination = this.pagination(page, limit);
    const term = search.trim();
    if (type === DecisionLinkType.TASK) {
      const [items, total] = await this.tasks.findAndCount({
        where: {
          project: { id: projectId },
          organization_id: org,
          ...(term ? { title: Like(`%${term}%`) } : {}),
        },
        select: ['id', 'title'],
        order: { title: 'ASC' },
        skip: pagination.skip,
        take: pagination.limit,
      });
      return {
        data: items.map((item) => ({ id: String(item.id), label: item.title })),
        meta: this.meta(pagination, total, items.length),
      };
    }
    if (type === DecisionLinkType.DOCUMENT) {
      const [items, total] = await this.documents.findAndCount({
        where: {
          project: { id: projectId },
          organization_id: org,
          ...(term ? { title: Like(`%${term}%`) } : {}),
        },
        select: ['id', 'title'],
        order: { title: 'ASC' },
        skip: pagination.skip,
        take: pagination.limit,
      });
      return {
        data: items.map((item) => ({ id: item.id, label: item.title })),
        meta: this.meta(pagination, total, items.length),
      };
    }
    if (type === DecisionLinkType.MESSAGE) {
      const [items, total] = await this.messages.findAndCount({
        where: {
          projectId,
          organization_id: org,
          ...(term ? { content: Like(`%${term}%`) } : {}),
        },
        select: ['id', 'content', 'created_at'],
        order: { created_at: 'DESC' },
        skip: pagination.skip,
        take: pagination.limit,
      });
      return {
        data: items.map((item) => ({
          id: item.id,
          label: this.textLabel(item.content, 'Project message'),
        })),
        meta: this.meta(pagination, total, items.length),
      };
    }
    if (type === DecisionLinkType.NOTE) {
      const query = this.notes
        .createQueryBuilder('note')
        .innerJoin('note.task', 'task')
        .where('note.organization_id = :org', { org })
        .andWhere('task.project_id = :projectId', { projectId });
      if (term) query.andWhere('note.note LIKE :term', { term: `%${term}%` });
      query
        .orderBy('note.created_at', 'DESC')
        .skip(pagination.skip)
        .take(pagination.limit);
      const [items, total] = await query.getManyAndCount();
      return {
        data: items.map((item) => ({
          id: String(item.id),
          label: this.textLabel(item.note, 'Note'),
        })),
        meta: this.meta(pagination, total, items.length),
      };
    }
    const peers = await this.peers.find({
      where: {
        project: { id: projectId },
        organization_id: org,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
      relations: ['user'],
    });
    const members = new Map<number, User>();
    members.set(Number(access.project.user.id), access.project.user);
    peers.forEach((peer) => members.set(Number(peer.user.id), peer.user));
    const matched = [...members.values()]
      .map((user) => ({
        id: String(user.id),
        label: user.fullName || user.email,
      }))
      .filter(
        (user) =>
          !term || user.label.toLowerCase().includes(term.toLowerCase()),
      );
    const data = matched.slice(
      pagination.skip,
      pagination.skip + pagination.limit,
    );
    return { data, meta: this.meta(pagination, matched.length, data.length) };
  }

  async create(
    actor: any,
    org: string,
    projectId: number,
    dto: SaveDecisionDto,
  ) {
    const access = await this.access(actor, org, projectId);
    if (!access.canContribute)
      throw new ForbiddenException(
        'Contributor access is required to propose decisions',
      );
    await this.assertOwner(dto.owner_id, access);
    const validatedLinks = await this.validateLinks(
      dto.links ?? [],
      org,
      projectId,
    );
    return this.decisions.manager.transaction(async (manager) => {
      const item = await manager.save(
        Decision,
        manager.create(Decision, {
          ...this.content(dto),
          organization_id: org,
          project_id: projectId,
          created_by_id: access.user.id,
          status: DecisionStatus.PROPOSED,
        }),
      );
      if (validatedLinks.length)
        await manager.save(
          DecisionLink,
          validatedLinks.map((link) =>
            manager.create(DecisionLink, { ...link, decision_id: item.id }),
          ),
        );
      await manager.save(
        DecisionHistory,
        manager.create(DecisionHistory, {
          decision_id: item.id,
          actor_id: access.user.id,
          action: 'proposed',
          snapshot: this.snapshot(item, validatedLinks),
        }),
      );
      return manager.findOne(Decision, {
        where: { id: item.id },
        relations: ['owner', 'created_by', 'links', 'supersedes'],
      });
    });
  }

  async update(
    actor: any,
    org: string,
    projectId: number,
    id: number,
    dto: SaveDecisionDto,
  ) {
    const access = await this.access(actor, org, projectId);
    const item = await this.get(id, org, projectId);
    if (item.status === DecisionStatus.SUPERSEDED)
      throw new BadRequestException('Superseded decisions are immutable');
    if (
      !access.canManage &&
      (item.status !== DecisionStatus.PROPOSED ||
        Number(item.created_by_id) !== Number(access.user.id))
    )
      throw new ForbiddenException(
        'Contributors may edit only their own proposals',
      );
    await this.assertOwner(dto.owner_id, access);
    const validatedLinks = await this.validateLinks(
      dto.links ?? [],
      org,
      projectId,
    );
    return this.decisions.manager.transaction(async (manager) => {
      Object.assign(item, this.content(dto));
      await manager.save(item);
      await manager.delete(DecisionLink, { decision_id: item.id });
      if (validatedLinks.length)
        await manager.save(
          DecisionLink,
          validatedLinks.map((link) =>
            manager.create(DecisionLink, { ...link, decision_id: item.id }),
          ),
        );
      await manager.save(
        DecisionHistory,
        manager.create(DecisionHistory, {
          decision_id: item.id,
          actor_id: access.user.id,
          action:
            item.status === DecisionStatus.PROPOSED
              ? 'edited'
              : 'administrative_correction',
          snapshot: this.snapshot(item, validatedLinks),
        }),
      );
      return manager.findOne(Decision, {
        where: { id: item.id },
        relations: ['owner', 'created_by', 'links', 'supersedes'],
      });
    });
  }

  async transition(
    actor: any,
    org: string,
    projectId: number,
    id: number,
    status: DecisionStatus,
  ) {
    const access = await this.access(actor, org, projectId);
    if (!access.canManage)
      throw new ForbiddenException('Editor access is required');
    if (![DecisionStatus.ACCEPTED, DecisionStatus.REJECTED].includes(status))
      throw new BadRequestException(
        'A proposal may only be accepted or rejected',
      );
    const item = await this.get(id, org, projectId);
    if (item.status !== DecisionStatus.PROPOSED)
      throw new BadRequestException(
        'Only proposed decisions can be accepted or rejected',
      );
    item.status = status;
    await this.decisions.save(item);
    await this.record(item, access.user.id, status);
    return this.get(id, org, projectId);
  }

  async supersede(
    actor: any,
    org: string,
    projectId: number,
    id: number,
    dto: SaveDecisionDto,
  ) {
    const access = await this.access(actor, org, projectId);
    if (!access.canManage)
      throw new ForbiddenException('Editor access is required');
    const old = await this.get(id, org, projectId);
    if (old.status !== DecisionStatus.ACCEPTED)
      throw new BadRequestException(
        'Only accepted decisions can be superseded',
      );
    await this.assertOwner(dto.owner_id, access);
    const validatedLinks = await this.validateLinks(
      dto.links ?? [],
      org,
      projectId,
    );
    return this.decisions.manager.transaction(async (manager) => {
      old.status = DecisionStatus.SUPERSEDED;
      await manager.save(old);
      const next = await manager.save(
        Decision,
        manager.create(Decision, {
          ...this.content(dto),
          organization_id: org,
          project_id: projectId,
          created_by_id: access.user.id,
          status: DecisionStatus.ACCEPTED,
          supersedes_decision_id: old.id,
        }),
      );
      if (validatedLinks.length)
        await manager.save(
          DecisionLink,
          validatedLinks.map((link) =>
            manager.create(DecisionLink, { ...link, decision_id: next.id }),
          ),
        );
      await manager.save(DecisionHistory, [
        manager.create(DecisionHistory, {
          decision_id: old.id,
          actor_id: access.user.id,
          action: 'superseded',
          snapshot: this.snapshot(old),
        }),
        manager.create(DecisionHistory, {
          decision_id: next.id,
          actor_id: access.user.id,
          action: 'accepted',
          snapshot: this.snapshot(next, validatedLinks),
        }),
      ]);
      return manager.findOne(Decision, {
        where: { id: next.id },
        relations: ['owner', 'created_by', 'links', 'supersedes'],
      });
    });
  }

  async removeProposal(actor: any, org: string, projectId: number, id: number) {
    const access = await this.access(actor, org, projectId);
    const item = await this.get(id, org, projectId);
    if (item.status !== DecisionStatus.PROPOSED)
      throw new BadRequestException(
        'Accepted, rejected, and superseded decisions cannot be deleted',
      );
    if (
      !access.isOwner &&
      Number(item.created_by_id) !== Number(access.user.id)
    )
      throw new ForbiddenException('You can only delete your own proposal');
    await this.decisions.remove(item);
    return { success: true };
  }

  async exportDecision(actor: any, org: string, projectId: number, id: number) {
    const access = await this.access(actor, org, projectId);
    const item = await this.get(id, org, projectId);
    this.assertReadable(item, access);
    const history = await this.histories.find({
      where: { decision_id: id },
      order: { created_at: 'ASC' },
    });
    await this.lifecycle.record({
      organizationId: org,
      actorId: access.user.id,
      recordType: LifecycleRecordType.DECISION,
      recordId: id,
      action: 'exported',
      metadata: { project_id: projectId, format: 'json' },
    });
    return {
      exported_at: new Date().toISOString(),
      record_type: LifecycleRecordType.DECISION,
      data: {
        id: item.id,
        project_id: item.project_id,
        title: item.title,
        context: item.context,
        decision_date: item.decision_date,
        status: item.status,
        supersedes_decision_id: item.supersedes_decision_id,
        owner: item.owner
          ? {
              id: item.owner.id,
              name: item.owner.fullName,
              email: item.owner.email,
            }
          : { id: item.owner_id },
        created_by: item.created_by
          ? {
              id: item.created_by.id,
              name: item.created_by.fullName,
              email: item.created_by.email,
            }
          : { id: item.created_by_id },
        links: item.links,
        created_at: item.created_at,
        updated_at: item.updated_at,
      },
      history,
    };
  }

  async deleteDecisionData(
    actor: any,
    org: string,
    projectId: number,
    id: number,
  ) {
    const access = await this.access(actor, org, projectId);
    if (!access.canManage)
      throw new ForbiddenException('Editor access is required');
    const item = await this.get(id, org, projectId);
    await this.decisions.manager.transaction(async (manager) => {
      await this.lifecycle.record({
        organizationId: org,
        actorId: access.user.id,
        recordType: LifecycleRecordType.DECISION,
        recordId: id,
        action: 'deleted',
        metadata: {
          project_id: projectId,
          previous_status: item.status,
          deletion: 'hard',
        },
        manager,
      });
      await manager.update(
        Decision,
        { supersedes_decision_id: id },
        { supersedes_decision_id: null },
      );
      // Cascades remove links and content-bearing history snapshots.
      await manager.remove(Decision, item);
    });
    return { success: true, deletion: 'completed' };
  }

  async accessHistory(actor: any, org: string, projectId: number, id: number) {
    const access = await this.access(actor, org, projectId);
    const item = await this.get(id, org, projectId);
    this.assertReadable(item, access);
    await this.lifecycle.record({
      organizationId: org,
      actorId: access.user.id,
      recordType: LifecycleRecordType.DECISION,
      recordId: id,
      action: 'accessed',
      metadata: { resource: 'access_history', project_id: projectId },
    });
    return this.lifecycle.history(org, LifecycleRecordType.DECISION, id);
  }

  async history(
    actor: any,
    org: string,
    projectId: number,
    id: number,
    page = 1,
    limit = 10,
  ) {
    const access = await this.access(actor, org, projectId);
    const item = await this.get(id, org, projectId);
    if (
      item.status === DecisionStatus.PROPOSED &&
      (!access.canContribute ||
        (!access.canManage &&
          Number(item.created_by_id) !== Number(access.user.id)))
    )
      throw new ForbiddenException(
        'You can only view history for your own proposals',
      );
    const pagination = this.pagination(page, limit);
    const [data, total] = await this.histories.findAndCount({
      where: { decision_id: id },
      relations: ['actor'],
      order: { created_at: 'DESC' },
      skip: pagination.skip,
      take: pagination.limit,
    });
    return { data, meta: this.meta(pagination, total, data.length) };
  }

  private async validateLinks(
    input: DecisionLinkDto[],
    org: string,
    projectId: number,
  ) {
    const seen = new Set<string>();
    const result: Array<
      Pick<DecisionLink, 'link_type' | 'link_id' | 'snapshot_label'>
    > = [];
    for (const link of input) {
      const key = `${link.type}:${link.id}`;
      if (seen.has(key))
        throw new BadRequestException(`Duplicate decision link ${key}`);
      seen.add(key);
      let label: string | undefined;
      if (link.type === DecisionLinkType.TASK)
        label = (
          await this.tasks.findOne({
            where: {
              id: Number(link.id),
              organization_id: org,
              project: { id: projectId },
            },
          })
        )?.title;
      if (link.type === DecisionLinkType.DOCUMENT)
        label = (
          await this.documents.findOne({
            where: {
              id: link.id,
              organization_id: org,
              project: { id: projectId },
            },
          })
        )?.title;
      if (link.type === DecisionLinkType.MESSAGE) {
        const message = await this.messages.findOne({
          where: { id: link.id, organization_id: org, projectId },
        });
        label = message
          ? this.textLabel(message.content, 'Project message')
          : undefined;
      }
      if (link.type === DecisionLinkType.NOTE) {
        const note = await this.notes
          .createQueryBuilder('note')
          .innerJoin('note.task', 'task')
          .where('note.id = :id', { id: Number(link.id) })
          .andWhere('note.organization_id = :org', { org })
          .andWhere('task.project_id = :projectId', { projectId })
          .getOne();
        label = note ? this.textLabel(note.note, 'Note') : undefined;
      }
      if (link.type === DecisionLinkType.USER) {
        const member = await this.isProjectMember(
          Number(link.id),
          org,
          projectId,
        );
        label = member?.fullName || member?.email;
      }
      if (!label)
        throw new BadRequestException(
          `Invalid ${link.type} link ${link.id} for this project`,
        );
      result.push({
        link_type: link.type,
        link_id: link.id,
        snapshot_label: label,
      });
    }
    return result;
  }

  private get(id: number, org: string, projectId: number) {
    return this.decisions
      .findOne({
        where: { id, organization_id: org, project_id: projectId },
        relations: ['owner', 'created_by', 'links', 'supersedes'],
      })
      .then((item) => {
        if (!item) throw new NotFoundException('Decision not found');
        return item;
      });
  }
  private assertReadable(item: Decision, access: Access) {
    if (
      item.status === DecisionStatus.PROPOSED &&
      (!access.canContribute ||
        (!access.canManage &&
          Number(item.created_by_id) !== Number(access.user.id)))
    )
      throw new ForbiddenException('You can only access your own proposals');
  }
  private content(dto: SaveDecisionDto) {
    if (!dto.title.trim() || !dto.context.trim())
      throw new BadRequestException('Title and context are required');
    return {
      title: dto.title.trim(),
      context: dto.context.trim(),
      owner_id: dto.owner_id,
      decision_date: dto.decision_date.slice(0, 10),
    };
  }
  private snapshot(
    decision: Decision,
    links: Array<
      Pick<DecisionLink, 'link_type' | 'link_id' | 'snapshot_label'>
    > = decision.links ?? [],
  ) {
    return {
      id: decision.id,
      title: decision.title,
      context: decision.context,
      owner_id: decision.owner_id,
      decision_date: decision.decision_date,
      status: decision.status,
      supersedes_decision_id: decision.supersedes_decision_id,
      links: links.map((link) => ({
        type: link.link_type,
        id: link.link_id,
        label: link.snapshot_label,
      })),
    };
  }
  private record(decision: Decision, actor: number, action: string) {
    return this.histories.save(
      this.histories.create({
        decision_id: decision.id,
        actor_id: actor,
        action,
        snapshot: this.snapshot(decision),
      }),
    );
  }
  private pagination(page: number, limit: number) {
    const safePage = Math.max(1, Number(page) || 1),
      safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    return {
      page: safePage,
      limit: safeLimit,
      skip: (safePage - 1) * safeLimit,
    };
  }
  private meta(
    pagination: { page: number; limit: number; skip: number },
    total: number,
    count: number,
  ) {
    return {
      current_page: pagination.page,
      per_page: pagination.limit,
      last_page: Math.max(1, Math.ceil(total / pagination.limit)),
      from: total ? pagination.skip + 1 : 0,
      to: total ? pagination.skip + count : 0,
      total,
    };
  }
  private textLabel(value: string | null | undefined, fallback: string) {
    const text = value?.replace(/\s+/g, ' ').trim();
    return text
      ? text.length > 120
        ? `${text.slice(0, 117)}...`
        : text
      : fallback;
  }
  private async isProjectMember(
    userId: number,
    org: string,
    projectId: number,
  ) {
    const project = await this.projects.findOne({
      where: { id: projectId, organization_id: org },
      relations: ['user'],
    });
    if (Number(project?.user?.id) === userId) return project!.user;
    const peer = await this.peers.findOne({
      where: {
        project: { id: projectId },
        user: { id: userId },
        organization_id: org,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
      relations: ['user'],
    });
    return peer?.user;
  }
  private async assertOwner(id: number, access: Access) {
    const member = await this.isProjectMember(
      Number(id),
      access.project.organization_id,
      access.project.id,
    );
    if (!member)
      throw new BadRequestException('Decision owner must be a project member');
  }
  private async access(
    actor: any,
    org: string,
    projectId: number,
  ): Promise<Access> {
    const user = await this.users.findOne({ where: { id: actor.userId } });
    const project = await this.projects.findOne({
      where: { id: projectId, organization_id: org },
      relations: ['user'],
    });
    if (!user || !project) throw new NotFoundException('Project not found');
    const peer = await this.peers.findOne({
      where: {
        project: { id: projectId },
        user: { id: user.id },
        organization_id: org,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
    });
    const isOwner =
      Number(project.user.id) === Number(user.id) ||
      actor.role === 'super_admin';
    if (!isOwner && !peer)
      throw new ForbiddenException('You do not have access to this project');
    const role = isOwner ? ProjectRole.OWNER : peer?.role ?? ProjectRole.VIEWER;
    return {
      user,
      project,
      isOwner,
      role,
      canContribute: ProjectRolePolicy.canContribute(role),
      canManage: ProjectRolePolicy.canEdit(role),
    };
  }
}
