import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthorizationService, ProjectPermission } from 'src/common/authorization/authorization.service';
import { Task } from 'src/typeorm/entities/Task';
import { TaskComment } from 'src/typeorm/entities/TaskComment';
import { IsNull, Repository } from 'typeorm';

@Injectable()
export class AiTaskContextService {
  constructor(
    @InjectRepository(Task) private tasks: Repository<Task>,
    @InjectRepository(TaskComment) private comments: Repository<TaskComment>,
    private authorization: AuthorizationService,
  ) {}

  async assembleDiscussion(actor: any, organizationId: string, taskId: number) {
    const task = await this.tasks.findOne({
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

    const comments = await this.comments.find({
      where: {
        task_id: taskId,
        organization_id: organizationId,
        deleted_at: IsNull(),
      },
      relations: ['author'],
      order: { created_at: 'DESC' },
      take: 100,
    });

    const transcript = comments
      .reverse()
      .map((comment) => {
        const author = comment.author?.fullName || comment.author?.email || 'Member';
        return `${author}: ${comment.content}`;
      })
      .join('\n');

    return [
      `Task: ${task.title}`,
      `Discussion (${comments.length} most recent comments):`,
      transcript || 'No comments have been posted.',
    ].join('\n');
  }
}
