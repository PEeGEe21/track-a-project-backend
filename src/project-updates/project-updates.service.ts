import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Like, Repository } from 'typeorm';
import { Document } from 'src/typeorm/entities/Document';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectUpdate, ProjectUpdateHealth, ProjectUpdateStatus } from 'src/typeorm/entities/ProjectUpdate';
import { ProjectUpdateReference, ProjectUpdateReferenceType } from 'src/typeorm/entities/ProjectUpdateReference';
import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { SaveProjectUpdateDto } from './dto/project-update.dto';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { ProjectRolePolicy } from 'src/common/authorization/project-role.policy';

@Injectable()
export class ProjectUpdatesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ProjectUpdate) private readonly updates: Repository<ProjectUpdate>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectPeer) private readonly peers: Repository<ProjectPeer>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Document) private readonly documents: Repository<Document>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserOrganization) private readonly memberships: Repository<UserOrganization>,
    private readonly notifications: NotificationsService,
  ) {}

  async list(actor: any, organizationId: string, projectId: number, includeDrafts = false, page = 1, limit = 10, filters: { status?: 'all' | 'draft' | 'published'; health?: string; mine?: boolean } = {}) {
    const access = await this.assertAccess(actor, organizationId, projectId);
    let statuses = includeDrafts && access.canCreate ? [ProjectUpdateStatus.DRAFT, ProjectUpdateStatus.PUBLISHED] : [ProjectUpdateStatus.PUBLISHED];
    if (filters.status === ProjectUpdateStatus.DRAFT && access.canCreate) statuses = [ProjectUpdateStatus.DRAFT];
    if (filters.status === ProjectUpdateStatus.PUBLISHED) statuses = [ProjectUpdateStatus.PUBLISHED];
    const pagination = this.pagination(page, limit);
    const base: any = { project_id: projectId, organization_id: organizationId, status: In(statuses), is_latest: true };
    if (Object.values(ProjectUpdateHealth).includes(filters.health as ProjectUpdateHealth)) base.health = filters.health;
    if (filters.mine) base.author_id = access.user.id;
    let where: any = base;
    if (includeDrafts && access.canCreate && !access.canManage && filters.status !== ProjectUpdateStatus.PUBLISHED) {
      where = [{ ...base, status: ProjectUpdateStatus.PUBLISHED }, { ...base, status: ProjectUpdateStatus.DRAFT, author_id: access.user.id }];
    }
    const [data, total] = await this.updates.findAndCount({ where, relations: ['author', 'references'], order: { created_at: 'DESC' }, skip: pagination.skip, take: pagination.limit });
    return { data, meta: this.meta(pagination.page, pagination.limit, total, data.length) };
  }

  async get(actor: any, organizationId: string, projectId: number, updateId: number) {
    const access = await this.assertAccess(actor, organizationId, projectId);
    const update = await this.findUpdate(organizationId, projectId, updateId);
    if (update.status === ProjectUpdateStatus.DRAFT && !access.canManage && Number(update.author_id) !== Number(access.user.id)) throw new ForbiddenException('You can only view your own drafts');
    return update;
  }

  async referenceOptions(actor: any, organizationId: string, projectId: number, type: 'task' | 'document' | 'user' = 'task', search = '', page = 1, limit = 20) {
    const access = await this.assertAccess(actor, organizationId, projectId);
    const pagination = this.pagination(page, limit);
    const term = search.trim();
    if (type === 'task') {
      const [items, total] = await this.tasks.findAndCount({ where: { project: { id: projectId }, organization_id: organizationId, ...(term ? { title: Like(`%${term}%`) } : {}) }, select: ['id', 'title'], order: { title: 'ASC' }, skip: pagination.skip, take: pagination.limit });
      return { data: items.map((item) => ({ id: String(item.id), label: item.title })), meta: this.meta(pagination.page, pagination.limit, total, items.length) };
    }
    if (type === 'document') {
      const [items, total] = await this.documents.findAndCount({ where: { project: { id: projectId }, organization_id: organizationId, ...(term ? { title: Like(`%${term}%`) } : {}) }, select: ['id', 'title'], order: { title: 'ASC' }, skip: pagination.skip, take: pagination.limit });
      return { data: items.map((item) => ({ id: item.id, label: item.title })), meta: this.meta(pagination.page, pagination.limit, total, items.length) };
    }
    const peers = await this.peers.find({ where: { project: { id: projectId }, organization_id: organizationId, status: ProjectPeerStatus.CONNECTED, is_confirmed: true }, relations: ['user'] });
    const users = new Map<number, User>();
    users.set(Number(access.project.user.id), access.project.user);
    peers.forEach((peer) => users.set(Number(peer.user.id), peer.user));
    const matched = [...users.values()].map((user) => ({ id: String(user.id), label: user.fullName || user.email })).filter((user) => !term || user.label.toLowerCase().includes(term.toLowerCase()));
    const data = matched.slice(pagination.skip, pagination.skip + pagination.limit);
    return { data, meta: this.meta(pagination.page, pagination.limit, matched.length, data.length) };
  }

  async createDraft(actor: any, organizationId: string, projectId: number, dto: SaveProjectUpdateDto) {
    const access = await this.assertAccess(actor, organizationId, projectId);
    if (!access.canCreate) throw new ForbiddenException('Contributor access is required to create project update drafts');
    return this.dataSource.transaction(async (manager) => {
      const update = await manager.save(ProjectUpdate, manager.create(ProjectUpdate, { ...this.content(dto), project_id: projectId, organization_id: organizationId, author_id: access.user.id, status: ProjectUpdateStatus.DRAFT }));
      update.series_id = update.id;
      await manager.save(update);
      update.references = await this.buildReferences(dto, organizationId, projectId, manager.getRepository(ProjectUpdateReference), update.id);
      await manager.save(update.references);
      return manager.findOne(ProjectUpdate, { where: { id: update.id }, relations: ['author', 'references'] });
    });
  }

  async updateDraft(actor: any, organizationId: string, projectId: number, updateId: number, dto: SaveProjectUpdateDto) {
    const access = await this.assertAccess(actor, organizationId, projectId);
    const update = await this.findUpdate(organizationId, projectId, updateId);
    if (update.status !== ProjectUpdateStatus.DRAFT) throw new BadRequestException('Published updates are immutable; create a correction instead');
    if (!access.canManage && Number(update.author_id) !== Number(access.user.id)) throw new ForbiddenException('You can only edit your own drafts');
    return this.dataSource.transaction(async (manager) => {
      Object.assign(update, this.content(dto));
      await manager.save(update);
      await manager.delete(ProjectUpdateReference, { project_update_id: update.id });
      const refs = await this.buildReferences(dto, organizationId, projectId, manager.getRepository(ProjectUpdateReference), update.id);
      await manager.save(refs);
      return manager.findOne(ProjectUpdate, { where: { id: update.id }, relations: ['author', 'references'] });
    });
  }

  async deleteDraft(actor: any, organizationId: string, projectId: number, updateId: number) {
    const access = await this.assertAccess(actor, organizationId, projectId);
    const update = await this.findUpdate(organizationId, projectId, updateId);
    if (update.status !== ProjectUpdateStatus.DRAFT) throw new BadRequestException('Published updates cannot be deleted; publish a correction instead');
    if (!access.canManage && Number(update.author_id) !== Number(access.user.id)) throw new ForbiddenException('You can only delete your own drafts');
    await this.updates.delete({ id: update.id });
    return { success: true, message: 'Project update draft deleted' };
  }

  async publish(actor: any, organizationId: string, projectId: number, updateId: number) {
    const access = await this.assertAccess(actor, organizationId, projectId);
    if (!access.canManage) throw new ForbiddenException('Editor access is required to publish project updates');
    const update = await this.findUpdate(organizationId, projectId, updateId);
    if (update.status !== ProjectUpdateStatus.DRAFT) throw new BadRequestException('Update is already published');
    update.status = ProjectUpdateStatus.PUBLISHED; update.published_at = new Date();
    const published = await this.updates.save(update);
    await this.notifyMembers(access.project, access.user, published, organizationId);
    return published;
  }

  async correct(actor: any, organizationId: string, projectId: number, updateId: number, dto: SaveProjectUpdateDto) {
    const access = await this.assertAccess(actor, organizationId, projectId);
    if (!access.canCreate) throw new ForbiddenException('Contributor access is required to correct project updates');
    const original = await this.findUpdate(organizationId, projectId, updateId);
    if (original.status !== ProjectUpdateStatus.PUBLISHED) throw new BadRequestException('Only published updates can be corrected');
    if (Number(original.author_id) !== Number(access.user.id) && !access.isOwner && actor.role !== 'super_admin') throw new ForbiddenException('Only the author or project owner can correct this update');
    const correction = await this.dataSource.transaction(async (manager) => {
      const seriesId = original.series_id ?? original.id;
      const latest = await manager.findOne(ProjectUpdate, { where: { series_id: seriesId }, order: { version: 'DESC' }, lock: { mode: 'pessimistic_write' } });
      await manager.update(ProjectUpdate, { series_id: seriesId }, { is_latest: false });
      const next = await manager.save(ProjectUpdate, manager.create(ProjectUpdate, { ...this.content(dto), project_id: projectId, organization_id: organizationId, author_id: access.user.id, status: ProjectUpdateStatus.PUBLISHED, published_at: new Date(), series_id: seriesId, corrects_update_id: original.id, version: (latest?.version ?? original.version) + 1 }));
      next.references = await this.buildReferences(dto, organizationId, projectId, manager.getRepository(ProjectUpdateReference), next.id);
      await manager.save(next.references);
      return next;
    });
    await this.notifyMembers(access.project, access.user, correction, organizationId);
    return correction;
  }

  async history(actor: any, organizationId: string, projectId: number, updateId: number, page = 1, limit = 10) {
    await this.assertAccess(actor, organizationId, projectId);
    const update = await this.findUpdate(organizationId, projectId, updateId);
    const pagination = this.pagination(page, limit);
    const [data, total] = await this.updates.findAndCount({ where: { series_id: update.series_id ?? update.id, status: ProjectUpdateStatus.PUBLISHED }, relations: ['author', 'references'], order: { version: 'DESC' }, skip: pagination.skip, take: pagination.limit });
    return { data, meta: this.meta(pagination.page, pagination.limit, total, data.length) };
  }

  private pagination(page: number, limit: number) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
  }

  private meta(page: number, limit: number, total: number, count: number) {
    return { current_page: page, per_page: limit, last_page: Math.max(1, Math.ceil(total / limit)), from: total ? (page - 1) * limit + 1 : 0, to: total ? (page - 1) * limit + count : 0, total };
  }

  private content(dto: SaveProjectUpdateDto) {
    if (dto.reporting_period_start && dto.reporting_period_end && dto.reporting_period_start > dto.reporting_period_end) throw new BadRequestException('Reporting period start must not be after its end');
    return { health: dto.health, accomplishments: dto.accomplishments?.trim() || null, blockers: dto.blockers?.trim() || null, next_steps: dto.next_steps?.trim() || null, reporting_period_start: dto.reporting_period_start ?? null, reporting_period_end: dto.reporting_period_end ?? null };
  }

  private async findUpdate(org: string, projectId: number, id: number) {
    const update = await this.updates.findOne({ where: { id, organization_id: org, project_id: projectId }, relations: ['author', 'references'] });
    if (!update) throw new NotFoundException('Project update not found');
    return update;
  }

  private async assertAccess(actor: any, org: string, projectId: number) {
    const user = await this.users.findOne({ where: { id: actor.userId } });
    const project = await this.projects.findOne({ where: { id: projectId, organization_id: org }, relations: ['user'] });
    if (!user || !project) throw new NotFoundException('Project not found');
    const peer = await this.peers.findOne({ where: { project: { id: projectId }, user: { id: user.id }, organization_id: org, status: ProjectPeerStatus.CONNECTED, is_confirmed: true } });
    const isOwner = Number(project.user?.id) === Number(user.id);
    if (!isOwner && !peer && actor.role !== 'super_admin') throw new ForbiddenException('You do not have access to this project');
    const role = isOwner || actor.role === 'super_admin' ? ProjectRole.OWNER : peer?.role ?? ProjectRole.EDITOR;
    const canCreate = ProjectRolePolicy.canContribute(role);
    const canManage = ProjectRolePolicy.canEdit(role);
    return { user, project, isOwner, role, canCreate, canManage };
  }

  private async buildReferences(dto: SaveProjectUpdateDto, org: string, projectId: number, repo: Repository<ProjectUpdateReference>, updateId: number) {
    const refs: ProjectUpdateReference[] = [];
    for (const ref of dto.references ?? []) {
      let label = ref.label;
      if (ref.type === ProjectUpdateReferenceType.TASK) { const item = await this.tasks.findOne({ where: { id: Number(ref.id), organization_id: org, project: { id: projectId } } }); if (!item) throw new BadRequestException(`Invalid task reference ${ref.id}`); label = item.title; }
      if (ref.type === ProjectUpdateReferenceType.DOCUMENT) { const item = await this.documents.findOne({ where: { id: ref.id, organization_id: org, project: { id: projectId } } }); if (!item) throw new BadRequestException(`Invalid document reference ${ref.id}`); label = item.title; }
      if (ref.type === ProjectUpdateReferenceType.USER) { const member = await this.memberships.findOne({ where: { organization_id: org, user: { id: Number(ref.id) } } }); if (!member) throw new BadRequestException(`Invalid user reference ${ref.id}`); const item = await this.users.findOne({ where: { id: Number(ref.id) } }); label = item?.fullName || item?.email; }
      if (ref.type === ProjectUpdateReferenceType.MILESTONE) throw new BadRequestException('Milestone references are unavailable until the dedicated milestone model is implemented');
      refs.push(repo.create({ project_update_id: updateId, reference_type: ref.type, reference_id: ref.id, snapshot_label: label! }));
    }
    return refs;
  }

  private async notifyMembers(project: Project, sender: User, update: ProjectUpdate, org: string) {
    const peers = await this.peers.find({ where: { project: { id: project.id }, organization_id: org, status: ProjectPeerStatus.CONNECTED, is_confirmed: true }, relations: ['user'] });
    const recipients = new Map<number, User>(); recipients.set(Number(project.user.id), project.user); peers.forEach((p) => recipients.set(Number(p.user.id), p.user)); recipients.delete(Number(sender.id));
    await Promise.all([...recipients.values()].map((recipient) => this.notifications.createNotification(sender, { recipient, sender, title: `New update: ${project.title}`, message: 'A project update was published.', type: 'project_update', metadata: { projectId: project.id, projectUpdateId: update.id, deliveryKey: `project-update:${update.id}:${recipient.id}` } }, org)));
  }
}
