import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuthorizationService,
  ProjectPermission,
} from 'src/common/authorization/authorization.service';
import { Project } from 'src/typeorm/entities/Project';
import {
  ProjectUpdate,
  ProjectUpdateStatus,
} from 'src/typeorm/entities/ProjectUpdate';
import { Task } from 'src/typeorm/entities/Task';
import { Repository } from 'typeorm';

@Injectable()
export class AiProjectContextService {
  constructor(
    @InjectRepository(Project) private projects: Repository<Project>,
    @InjectRepository(Task) private tasks: Repository<Task>,
    @InjectRepository(ProjectUpdate)
    private updates: Repository<ProjectUpdate>,
    private authorization: AuthorizationService,
  ) {}

  async assembleUpdateContext(
    actor: any,
    organizationId: string,
    projectId: number,
  ) {
    const project = await this.projects.findOne({
      where: { id: projectId, organization_id: organizationId },
    });
    if (!project) throw new NotFoundException('Project not found');

    await this.authorization.assertProjectPermission(
      actor,
      organizationId,
      projectId,
      ProjectPermission.CONTRIBUTE,
    );

    const [tasks, updates] = await Promise.all([
      this.tasks.find({
        where: { project: { id: projectId }, organization_id: organizationId },
        relations: ['status'],
        order: { updated_at: 'DESC' },
        take: 100,
      }),
      this.updates.find({
        where: {
          project_id: projectId,
          organization_id: organizationId,
          status: ProjectUpdateStatus.PUBLISHED,
          is_latest: true,
        },
        order: { published_at: 'DESC' },
        take: 3,
      }),
    ]);

    const taskContext = tasks.map((task) =>
      [
        task.title,
        `status=${task.status?.title || 'unknown'}`,
        `terminal=${Boolean(task.status?.isTerminal)}`,
        task.due_date ? `due=${task.due_date.toISOString().slice(0, 10)}` : '',
        task.priority ? 'priority=true' : '',
      ]
        .filter(Boolean)
        .join(' | '),
    );
    const updateContext = updates.map((update) =>
      [
        `health=${update.health}`,
        `accomplishments=${update.accomplishments || 'none'}`,
        `blockers=${update.blockers || 'none'}`,
        `next_steps=${update.next_steps || 'none'}`,
      ].join(' | '),
    );

    return [
      `Project: ${project.title}`,
      `Description: ${project.description || 'none'}`,
      `Current tasks (${tasks.length} most recently updated):`,
      taskContext.join('\n') || 'none',
      `Recent published updates (${updates.length}):`,
      updateContext.join('\n') || 'none',
    ].join('\n');
  }
}
