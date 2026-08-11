import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthorizationService } from 'src/common/authorization/authorization.service';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Task } from 'src/typeorm/entities/Task';
import { AuthUser } from 'src/types/users';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { In, Repository } from 'typeorm';

const MAX_PROJECTS = 12;
const MAX_MEMBERS_PER_PROJECT = 20;
const MAX_TASK_SCAN = 100;
const MAX_DUPLICATES = 12;

export type AiIntakeMatchingContext = {
  sourceProjectId: number;
  projects: Array<{
    id: number;
    title: string;
    members: Array<{ id: number; name: string }>;
  }>;
  duplicateTasks: Array<{
    id: number;
    projectId: number;
    title: string;
  }>;
  categories: string[];
};

@Injectable()
export class AiIntakeMatchingContextService {
  constructor(
    private readonly authorization: AuthorizationService,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(ProjectPeer)
    private readonly peers: Repository<ProjectPeer>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
  ) {}

  async assemble(
    actor: AuthUser,
    organizationId: string,
    sourceProjectId: number,
    intakeTitle: string,
    excludedTaskId?: number | null,
  ): Promise<AiIntakeMatchingContext> {
    const scope = await this.authorization.getProjectAccessScope(actor, organizationId);
    const peerRows = scope.canAccessAllProjects
      ? []
      : await this.peers.find({
          where: {
            user: { id: actor.userId },
            organization_id: organizationId,
            status: ProjectPeerStatus.CONNECTED,
            is_confirmed: true,
          },
          relations: ['project'],
          take: MAX_PROJECTS,
        });
    const peerProjectIds = peerRows.map((peer) => Number(peer.project.id));
    const where = scope.canAccessAllProjects
      ? { organization_id: organizationId }
      : [
          { organization_id: organizationId, user: { id: actor.userId } },
          ...(peerProjectIds.length
            ? [{ organization_id: organizationId, id: In(peerProjectIds) }]
            : []),
        ];
    const accessible = await this.projects.find({
      where: where as any,
      relations: ['user', 'categories'],
      order: { updated_at: 'DESC' },
      take: MAX_PROJECTS,
    });
    if (!accessible.some((project) => Number(project.id) === sourceProjectId)) {
      const source = await this.projects.findOne({
        where: { id: sourceProjectId, organization_id: organizationId },
        relations: ['user', 'categories'],
      });
      if (source) accessible.unshift(source);
    }
    const selected = accessible.slice(0, MAX_PROJECTS);
    const projectIds = selected.map((project) => Number(project.id));
    const memberships = projectIds.length
      ? await this.peers.find({
          where: {
            project: { id: In(projectIds) },
            organization_id: organizationId,
            status: ProjectPeerStatus.CONNECTED,
            is_confirmed: true,
          },
          relations: ['project', 'user'],
          order: { created_at: 'ASC' },
          take: MAX_PROJECTS * MAX_MEMBERS_PER_PROJECT,
        })
      : [];
    const projectCandidates = selected.map((project) => {
      const members = [
        ...(project.user
          ? [{ id: Number(project.user.id), name: this.displayName(project.user) }]
          : []),
        ...memberships
          .filter((peer) => Number(peer.project.id) === Number(project.id))
          .map((peer) => ({ id: Number(peer.user.id), name: this.displayName(peer.user) })),
      ];
      return {
        id: Number(project.id),
        title: String(project.title).slice(0, 180),
        members: [...new Map(members.map((member) => [member.id, member])).values()].slice(
          0,
          MAX_MEMBERS_PER_PROJECT,
        ),
      };
    });
    const taskRows = projectIds.length
      ? await this.tasks.find({
          where: { organization_id: organizationId, project: { id: In(projectIds) } },
          relations: ['project'],
          order: { updated_at: 'DESC' },
          take: MAX_TASK_SCAN,
        })
      : [];
    const duplicateTasks = taskRows
      .filter((task) => Number(task.id) !== Number(excludedTaskId))
      .map((task) => ({
        id: Number(task.id),
        projectId: Number(task.project.id),
        title: String(task.title).slice(0, 255),
        score: this.titleScore(intakeTitle, task.title),
      }))
      .filter((task) => task.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_DUPLICATES)
      .map(({ score: _score, ...task }) => task);
    const categories = (selected.find((project) => Number(project.id) === sourceProjectId)?.categories ?? [])
      .filter((category) => category.organization_id === organizationId)
      .map((category) => String(category.name).slice(0, 100))
      .slice(0, 20);
    return { sourceProjectId, projects: projectCandidates, duplicateTasks, categories };
  }

  private displayName(user: any) {
    return (
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
      user.username ||
      `User ${user.id}`
    ).slice(0, 120);
  }

  private titleScore(source: string, candidate: string) {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 2);
    const sourceTokens = new Set(normalize(source));
    const candidateTokens = new Set(normalize(candidate));
    if (!sourceTokens.size || !candidateTokens.size) return 0;
    let overlap = 0;
    for (const token of sourceTokens) if (candidateTokens.has(token)) overlap += 1;
    return overlap / Math.max(sourceTokens.size, candidateTokens.size);
  }
}
