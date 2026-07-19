import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { Task } from 'src/typeorm/entities/Task';
import { TaskComment } from 'src/typeorm/entities/TaskComment';
import { TaskCommentEdit } from 'src/typeorm/entities/TaskCommentEdit';
import { TaskCommentReaction } from 'src/typeorm/entities/TaskCommentReaction';
import { User } from 'src/typeorm/entities/User';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { Notification } from 'src/typeorm/entities/Notification';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectRole } from 'src/utils/constants/projectRole';
@Injectable()
export class TaskDiscussionsService {
  constructor(
    @InjectRepository(TaskComment) private c: Repository<TaskComment>,
    @InjectRepository(TaskCommentReaction)
    private reactions: Repository<TaskCommentReaction>,
    @InjectRepository(TaskCommentEdit)
    private edits: Repository<TaskCommentEdit>,
    @InjectRepository(Task) private tasks: Repository<Task>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(ProjectPeer) private peers: Repository<ProjectPeer>,
    @InjectRepository(Project) private projects: Repository<Project>,
    @InjectRepository(Notification)
    private notifications: Repository<Notification>,
    private auth: AuthorizationService,
  ) {}
  private async access(actor: any, org: string, taskId: number, write = false) {
    const task = await this.tasks.findOne({
      where: { id: taskId, organization_id: org },
      relations: ['project', 'project.user'],
    });
    if (!task) throw new NotFoundException('Task not found');
    const ctx = await this.auth.assertProjectPermission(
      actor,
      org,
      task.project.id,
      write ? ProjectPermission.CONTRIBUTE : ProjectPermission.VIEW,
    );
    const user = await this.users.findOne({ where: { id: actor.userId } });
    return { task, ctx, user: user! };
  }
  async list(a: any, o: string, t: number, page = 1, limit = 10) {
    await this.access(a, o, t);
    const p = Math.max(1, +page || 1),
      l = Math.min(50, Math.max(1, +limit || 10));
    const [roots, total] = await this.c.findAndCount({
      where: { task_id: t, organization_id: o, parent_id: IsNull() },
      relations: ['author', 'reactions', 'reactions.user'],
      order: { created_at: 'DESC' },
      skip: (p - 1) * l,
      take: l,
    });
    const ids = roots.map((x) => x.id);
    const replies = ids.length
      ? await this.c.find({
          where: { task_id: t, organization_id: o, root_id: In(ids) },
          relations: ['author', 'reactions', 'reactions.user'],
          order: { created_at: 'ASC' },
        })
      : [];
    return {
      data: [...roots, ...replies],
      meta: {
        current_page: p,
        per_page: l,
        last_page: Math.max(1, Math.ceil(total / l)),
        total,
      },
    };
  }
  async mentionOptions(a: any, o: string, t: number) {
    const x = await this.access(a, o, t);
    const project = await this.projects.findOne({
      where: { id: x.task.project.id, organization_id: o },
      relations: ['user'],
    });
    const peers = await this.peers.find({
      where: {
        project: { id: x.task.project.id },
        organization_id: o,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
      relations: ['user'],
    });
    const members = new Map<number, User>();
    if (project?.user) members.set(Number(project.user.id), project.user);
    peers.forEach((p) => members.set(Number(p.user.id), p.user));
    return [...members.values()].map((u) => ({
      id: u.id,
      label: u.fullName || u.email,
    }));
  }
  async create(a: any, o: string, t: number, d: any) {
    const x = await this.access(a, o, t, true);
    const content = String(d.content || '').trim();
    if (!content) throw new BadRequestException('Comment is required');
    let parent: TaskComment | null = null;
    if (d.parent_id) {
      parent = await this.c.findOne({
        where: { id: d.parent_id, task_id: t, organization_id: o },
      });
      if (!parent) throw new BadRequestException('Parent comment not found');
    }
    const mentions: number[] = [
      ...new Set<number>(
        (d.mentions || []).map((value: unknown) => Number(value)),
      ),
    ];
    const members = await this.members(x.task.project.id, o);
    for (const id of mentions)
      if (!members.has(id))
        throw new BadRequestException(
          `Mentioned user ${id} is not a project member`,
        );
    const item = await this.c.save(
      this.c.create({
        task_id: t,
        organization_id: o,
        author_id: x.user.id,
        content,
        parent_id: parent?.id || null,
        root_id: parent ? parent.root_id || parent.id : null,
        mentions,
      }),
    );
    await Promise.all(
      mentions
        .filter((id) => id !== x.user.id)
        .map((id) =>
          this.notifications.save(
            this.notifications.create({
              recipient: { id } as User,
              sender: x.user,
              title: `Mention in ${x.task.title}`,
              message: content.slice(0, 160),
              type: 'task_comment_mention',
              organization_id: o,
              metadata: {
                taskId: t,
                projectId: x.task.project.id,
                commentId: item.id,
              },
            }),
          ),
        ),
    );
    return this.get(t, o, item.id);
  }
  async edit(a: any, o: string, t: number, id: string, content: string) {
    const x = await this.access(a, o, t, true),
      item = await this.get(t, o, id);
    if (
      Number(item.author_id) !== Number(x.user.id) &&
      x.ctx.role !== ProjectRole.OWNER
    )
      throw new ForbiddenException('Only the author or project owner can edit');
    if (item.deleted_at)
      throw new BadRequestException('Deleted comments cannot be edited');
    const next = String(content || '').trim();
    if (!next) throw new BadRequestException('Comment is required');
    await this.edits.save(
      this.edits.create({
        comment_id: id,
        editor_id: x.user.id,
        previous_content: item.content,
      }),
    );
    item.content = next;
    item.edited_at = new Date();
    return this.c.save(item);
  }
  async remove(a: any, o: string, t: number, id: string) {
    const x = await this.access(a, o, t, true),
      item = await this.get(t, o, id);
    if (
      Number(item.author_id) !== Number(x.user.id) &&
      x.ctx.role !== ProjectRole.OWNER
    )
      throw new ForbiddenException(
        'Only the author or project owner can delete',
      );
    item.content = '[deleted]';
    item.mentions = [];
    item.deleted_at = new Date();
    return this.c.save(item);
  }
  async react(a: any, o: string, t: number, id: string, emoji: string) {
    const x = await this.access(a, o, t, true);
    await this.get(t, o, id);
    if (!emoji || emoji.length > 32)
      throw new BadRequestException('Invalid reaction');
    const old = await this.reactions.findOne({
      where: { comment_id: id, user_id: x.user.id, emoji },
    });
    if (old) {
      await this.reactions.remove(old);
      return { active: false };
    }
    await this.reactions.save(
      this.reactions.create({ comment_id: id, user_id: x.user.id, emoji }),
    );
    return { active: true };
  }
  async resolve(a: any, o: string, t: number, id: string, resolved: boolean) {
    const x = await this.access(a, o, t, true),
      item = await this.get(t, o, id);
    item.is_resolved = !!resolved;
    item.resolved_by_id = resolved ? x.user.id : null;
    item.resolved_at = resolved ? new Date() : null;
    return this.c.save(item);
  }
  async history(a: any, o: string, t: number, id: string) {
    const x = await this.access(a, o, t);
    const item = await this.get(t, o, id);
    if (
      Number(item.author_id) !== Number(x.user.id) &&
      x.ctx.role !== ProjectRole.OWNER
    )
      throw new ForbiddenException('Edit history is restricted');
    return this.edits.find({
      where: { comment_id: id },
      relations: ['editor'],
      order: { created_at: 'DESC' },
    });
  }
  private async get(t: number, o: string, id: string) {
    const x = await this.c.findOne({
      where: { id, task_id: t, organization_id: o },
      relations: ['author', 'reactions', 'reactions.user'],
    });
    if (!x) throw new NotFoundException('Comment not found');
    return x;
  }
  private async members(projectId: number, o: string) {
    const project = await this.projects.findOne({
      where: { id: projectId, organization_id: o },
      relations: ['user'],
    });
    const peers = await this.peers.find({
      where: {
        project: { id: projectId },
        organization_id: o,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
      relations: ['user'],
    });
    const ids = new Set<number>();
    if (project?.user?.id) ids.add(Number(project.user.id));
    peers.forEach((p) => ids.add(Number(p.user.id)));
    return ids;
  }
}
