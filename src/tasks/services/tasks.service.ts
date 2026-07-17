import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Post } from '../../typeorm/entities/Post';
import { Profile } from '../../typeorm/entities/Profile';
import { User } from '../../typeorm/entities/User';
import {
  CreateTaskParams,
  CreateUserParams,
  CreateUserPostParams,
  CreateUserProfileParams,
  UpdateUserParams,
} from '../../utils/types';
import { Task } from 'src/typeorm/entities/Task';
import { Status } from 'src/typeorm/entities/Status';
import { Project } from 'src/typeorm/entities/Project';
import { UpdateTaskStatusDto } from '../dtos/update-task-status.dto';
import { DataSource } from 'typeorm';
import { NOTIFICATION_TYPES } from 'src/utils/constants/notifications';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { ActivityType } from 'src/utils/constants/activity';
import { ProjectActivitiesService } from 'src/project-activities/services/project-activities.service';
import { Organization } from 'src/typeorm/entities/Organization';
import { Resource } from 'src/typeorm/entities/Resource';
import { MulterFile } from 'src/types/multer.types';
import { StorageService } from 'src/types/storage.interface';
import { normalizeRichTextDescription } from 'src/common/helpers/rich-text.helper';
import { CreateNotificationDto } from 'src/notifications/dto/create-notification.dto';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { AuthorizationService } from 'src/common/authorization/authorization.service';
import { AuthUser } from 'src/types/users';
import {
  ProductivityTaskQueryDto,
  ProductivityTaskSort,
  ProductivityTaskView,
} from '../dtos/productivity-task-query.dto';
import {
  SavedTaskView,
  SavedTaskViewVisibility,
} from 'src/typeorm/entities/SavedTaskView';
import {
  CreateSavedTaskViewDto,
  UpdateSavedTaskViewDto,
} from '../dtos/saved-task-view.dto';
import { RecurringTasksService } from 'src/recurring-tasks/recurring-tasks.service';

@Injectable()
export class TasksService {
  constructor(
    private dataSource: DataSource,
    private notificationService: NotificationsService,
    private projectActivitiesService: ProjectActivitiesService,
    @Inject('STORAGE_SERVICE')
    private storageService: StorageService,

    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    // @InjectRepository(Post) private postRepository: Repository<Post>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(Task) private taskRepository: Repository<Task>,
    @InjectRepository(Status) private statusRepository: Repository<Status>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
    private readonly authorizationService: AuthorizationService,
    @InjectRepository(SavedTaskView)
    private savedTaskViewRepository: Repository<SavedTaskView>,
    private recurringTasksService: RecurringTasksService,
  ) {}

  private inferMimeType(
    filename: string,
    providedMimeType?: string | null,
  ): string | null {
    if (providedMimeType && providedMimeType.trim()) {
      return providedMimeType;
    }

    const lowerName = filename.toLowerCase();

    if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) {
      return 'text/markdown';
    }

    if (lowerName.endsWith('.txt')) {
      return 'text/plain';
    }

    return null;
  }

  private normalizeDueDateInput(value: unknown): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const parsedDate = new Date(String(value));
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  private async assertTaskWriteAccess(
    taskId: number,
    actor: AuthUser,
    organizationId: string,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, organization_id: organizationId },
      relations: ['project'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.authorizationService.assertProjectAccess({
      actor,
      organizationId,
      projectId: task.project.id,
      action: 'write',
    });

    return task;
  }

  private getTaskStatusNotificationRecipients(task: Task) {
    const recipients = new Map<number, User>();

    const addRecipient = (candidate?: User | null) => {
      if (!candidate?.id) {
        return;
      }

      recipients.set(candidate.id, candidate);
    };

    addRecipient(task.user);
    addRecipient(task.project?.user);

    for (const peer of task.project?.projectPeers ?? []) {
      if (
        peer?.user &&
        peer.status === ProjectPeerStatus.CONNECTED &&
        peer.is_confirmed !== false
      ) {
        addRecipient(peer.user);
      }
    }

    for (const assignee of task.assignees ?? []) {
      addRecipient(assignee);
    }

    return Array.from(recipients.values());
  }

  private buildTaskStatusNotificationPayload(
    actor: User,
    task: Task,
    action: 'completed' | 'reopened',
  ): Omit<CreateNotificationDto, 'recipient'> {
    const projectTitle = task.project?.title?.trim();
    const statusTitle = task.status?.title?.trim();

    return {
      sender: actor,
      title: action === 'completed' ? 'Task completed' : 'Task reopened',
      message:
        action === 'completed'
          ? `${actor.fullName} marked "${task.title}" as completed${
              projectTitle ? ` in ${projectTitle}` : ''
            }.`
          : `${actor.fullName} moved "${task.title}" back into active work${
              statusTitle ? ` in ${statusTitle}` : ''
            }.`,
      type: NOTIFICATION_TYPES.TASK_STATUS_CHANGE,
      metadata: {
        taskId: task.id,
        projectId: task.project?.id ?? null,
        statusId: task.status?.id ?? null,
        statusTitle: statusTitle ?? null,
        transition: action,
      },
    };
  }

  private async sendTaskTerminalStatusNotifications(params: {
    actor: User;
    previousStatus: Status;
    task: Task;
    organizationId: string;
  }) {
    const { actor, previousStatus, task, organizationId } = params;
    const movedIntoTerminal =
      !previousStatus.isTerminal && Boolean(task.status?.isTerminal);
    const movedOutOfTerminal =
      Boolean(previousStatus.isTerminal) && !task.status?.isTerminal;

    if (!movedIntoTerminal && !movedOutOfTerminal) {
      return;
    }

    const recipients = this.getTaskStatusNotificationRecipients(task);
    if (recipients.length === 0) {
      return;
    }

    const payload = this.buildTaskStatusNotificationPayload(
      actor,
      task,
      movedIntoTerminal ? 'completed' : 'reopened',
    );

    await Promise.all(
      recipients.map((recipient) =>
        this.notificationService.createNotification(
          actor,
          {
            ...payload,
            recipient,
          },
          organizationId,
        ),
      ),
    );
  }

  async findOne(id: number): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['project'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async getTaskById(
    id: number,
    actor: AuthUser,
    organizationId: string,
  ): Promise<Task | undefined> {
    const task = await this.taskRepository.findOne({
      where: { id, organization_id: organizationId },
      relations: ['project', 'status', 'assignees', 'resources'],
    });
    if (!task) throw new NotFoundException('Task not found');

    await this.authorizationService.assertProjectAccess({
      actor,
      organizationId,
      projectId: task.project.id,
      action: 'read',
    });

    return task;
  }

  async findTasks(actor: AuthUser, organizationId: string) {
    const scope = await this.authorizationService.getProjectAccessScope(
      actor,
      organizationId,
    );
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.tags', 'tags')
      .leftJoinAndSelect('task.status', 'status')
      .leftJoinAndSelect('task.assignees', 'assignees')
      .where('task.organization_id = :organizationId', { organizationId });

    if (!scope.canAccessAllProjects) {
      query.andWhere(
        `(
          project.user_id = :userId
          OR EXISTS (
            SELECT 1
            FROM project_peers access_peer
            WHERE access_peer.project_id = project.id
              AND access_peer.user_id = :userId
              AND access_peer.organization_id = :organizationId
              AND access_peer.status = :peerStatus
              AND access_peer.is_confirmed = :peerConfirmed
          )
        )`,
        {
          userId: scope.userId,
          organizationId,
          peerStatus: ProjectPeerStatus.CONNECTED,
          peerConfirmed: true,
        },
      );
    }

    const tasks = await query.getMany();
    const res = {
      success: 'success',
      message: 'successful',
      data: tasks,
    };

    return res;
  }

  private applyProductivityFilters(
    query: SelectQueryBuilder<Task>,
    filters: ProductivityTaskQueryDto,
  ) {
    if (filters.project_id) {
      query.andWhere('project.id = :projectId', {
        projectId: filters.project_id,
      });
    }
    if (filters.status_id) {
      query.andWhere('status.id = :statusId', { statusId: filters.status_id });
    }
    if (filters.priority !== undefined) {
      query.andWhere('task.priority = :priority', {
        priority: filters.priority,
      });
    }
    if (filters.assignee_id) {
      query.andWhere(
        `EXISTS (
          SELECT 1 FROM task_assignees filtered_assignee
          WHERE filtered_assignee.task_id = task.id
            AND filtered_assignee.user_id = :assigneeId
        )`,
        { assigneeId: filters.assignee_id },
      );
    }
    if (filters.due_from) {
      query.andWhere('task.due_date >= :dueFrom', {
        dueFrom: `${filters.due_from} 00:00:00`,
      });
    }
    if (filters.due_to) {
      query.andWhere('task.due_date < DATE_ADD(:dueTo, INTERVAL 1 DAY)', {
        dueTo: filters.due_to,
      });
    }
    if (filters.search?.trim()) {
      query
        .andWhere(
          new Brackets((search) => {
            search
              .where('task.title LIKE :search')
              .orWhere('task.description LIKE :search')
              .orWhere('project.title LIKE :search');
          }),
        )
        .setParameter('search', `%${filters.search.trim()}%`);
    }
  }

  private applyProductivityView(
    query: SelectQueryBuilder<Task>,
    view: ProductivityTaskView,
    userId: number,
    anchorDate: string,
  ) {
    switch (view) {
      case ProductivityTaskView.MY_TASKS:
        query.andWhere(
          `EXISTS (
            SELECT 1 FROM task_assignees my_assignment
            WHERE my_assignment.task_id = task.id
              AND my_assignment.user_id = :currentUserId
          )`,
          { currentUserId: userId },
        );
        break;
      case ProductivityTaskView.TODAY:
        query
          .andWhere('task.due_date >= :dayStart')
          .andWhere('task.due_date < DATE_ADD(:dayStart, INTERVAL 1 DAY)', {
            dayStart: anchorDate,
          });
        break;
      case ProductivityTaskView.UPCOMING:
        query.andWhere('task.due_date >= DATE_ADD(:dayStart, INTERVAL 1 DAY)', {
          dayStart: anchorDate,
        });
        break;
      case ProductivityTaskView.OVERDUE:
        query
          .andWhere('task.due_date < :dayStart', { dayStart: anchorDate })
          .andWhere('(status.id IS NULL OR status.isTerminal = :notTerminal)', {
            notTerminal: false,
          });
        break;
      case ProductivityTaskView.WAITING_ON:
        query.andWhere('LOWER(TRIM(status.title)) = :waitingOnStatus', {
          waitingOnStatus: 'waiting on',
        });
        break;
    }
  }

  async findProductivityTasks(
    actor: AuthUser,
    organizationId: string,
    filters: ProductivityTaskQueryDto,
  ) {
    const scope = await this.authorizationService.getProjectAccessScope(
      actor,
      organizationId,
    );
    const anchorDate = filters.date ?? new Date().toISOString().slice(0, 10);

    const baseQuery = this.taskRepository
      .createQueryBuilder('task')
      .leftJoin('task.project', 'project')
      .leftJoin('task.status', 'status')
      .where('task.organization_id = :organizationId', { organizationId });

    if (!scope.canAccessAllProjects) {
      baseQuery.andWhere(
        `(
          project.user_id = :userId
          OR EXISTS (
            SELECT 1 FROM project_peers access_peer
            WHERE access_peer.project_id = project.id
              AND access_peer.user_id = :userId
              AND access_peer.organization_id = :organizationId
              AND access_peer.status = :peerStatus
              AND access_peer.is_confirmed = :peerConfirmed
          )
        )`,
        {
          userId: scope.userId,
          peerStatus: ProjectPeerStatus.CONNECTED,
          peerConfirmed: true,
        },
      );
    }

    this.applyProductivityFilters(baseQuery, filters);

    const views = Object.values(ProductivityTaskView);
    const countEntries = await Promise.all(
      views.map(async (view) => {
        const countQuery = baseQuery.clone();
        this.applyProductivityView(countQuery, view, scope.userId, anchorDate);
        return [view, await countQuery.getCount()] as const;
      }),
    );

    const taskQuery = baseQuery
      .clone()
      .leftJoinAndSelect('task.project', 'selectedProject')
      .leftJoinAndSelect('selectedProject.statuses', 'projectStatuses')
      .leftJoinAndSelect('task.status', 'selectedStatus')
      .leftJoinAndSelect('task.assignees', 'assignees');
    this.applyProductivityView(
      taskQuery,
      filters.view,
      scope.userId,
      anchorDate,
    );

    const sortColumns: Record<ProductivityTaskSort, string> = {
      [ProductivityTaskSort.DUE_DATE]: 'task.due_date',
      [ProductivityTaskSort.PRIORITY]: 'task.priority',
      [ProductivityTaskSort.CREATED_AT]: 'task.created_at',
      [ProductivityTaskSort.UPDATED_AT]: 'task.updated_at',
      [ProductivityTaskSort.TITLE]: 'task.title',
    };
    if (filters.sort === ProductivityTaskSort.DUE_DATE) {
      taskQuery
        .addSelect('task.due_date IS NULL', 'task_due_date_is_null')
        .orderBy('task_due_date_is_null', 'ASC');
    }
    taskQuery
      .addOrderBy(
        sortColumns[filters.sort],
        filters.direction.toUpperCase() as 'ASC' | 'DESC',
      )
      .addOrderBy('task.id', 'ASC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    const [tasks, total] = await taskQuery.getManyAndCount();

    return {
      success: 'success',
      data: tasks,
      counts: Object.fromEntries(countEntries),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
      filters: { view: filters.view, date: anchorDate },
    };
  }

  async getSavedTaskViews(actor: AuthUser, organizationId: string) {
    await this.authorizationService.getProjectAccessScope(
      actor,
      organizationId,
    );
    const views = await this.savedTaskViewRepository.find({
      where: [
        { organization_id: organizationId, owner_id: actor.userId },
        {
          organization_id: organizationId,
          visibility: SavedTaskViewVisibility.ORGANIZATION,
        },
      ],
      order: { is_default: 'DESC', name: 'ASC', id: 'ASC' },
    });
    return {
      success: 'success',
      data: views.map((view) => ({
        ...view,
        can_edit: Number(view.owner_id) === Number(actor.userId),
      })),
    };
  }

  async createSavedTaskView(
    actor: AuthUser,
    organizationId: string,
    payload: CreateSavedTaskViewDto,
  ) {
    await this.authorizationService.getProjectAccessScope(
      actor,
      organizationId,
    );
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SavedTaskView);
      if (payload.is_default) {
        await repository.update(
          {
            organization_id: organizationId,
            owner_id: actor.userId,
            is_default: true,
          },
          { is_default: false },
        );
      }
      const view = repository.create({
        organization_id: organizationId,
        owner_id: actor.userId,
        name: payload.name.trim(),
        scope: 'personal_productivity',
        configuration: payload.configuration,
        visibility: payload.visibility,
        is_default: payload.is_default,
      });
      return { success: 'success', data: await repository.save(view) };
    });
  }

  private async getOwnedSavedTaskView(
    id: number,
    actor: AuthUser,
    organizationId: string,
  ) {
    await this.authorizationService.getProjectAccessScope(
      actor,
      organizationId,
    );
    const view = await this.savedTaskViewRepository.findOne({
      where: { id, organization_id: organizationId, owner_id: actor.userId },
    });
    if (!view) throw new NotFoundException('Saved view not found');
    return view;
  }

  async updateSavedTaskView(
    id: number,
    actor: AuthUser,
    organizationId: string,
    payload: UpdateSavedTaskViewDto,
  ) {
    const existing = await this.getOwnedSavedTaskView(
      id,
      actor,
      organizationId,
    );
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SavedTaskView);
      if (payload.is_default) {
        await repository.update(
          {
            organization_id: organizationId,
            owner_id: actor.userId,
            is_default: true,
          },
          { is_default: false },
        );
      }
      repository.merge(existing, {
        ...payload,
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      });
      return { success: 'success', data: await repository.save(existing) };
    });
  }

  async deleteSavedTaskView(
    id: number,
    actor: AuthUser,
    organizationId: string,
  ) {
    const view = await this.getOwnedSavedTaskView(id, actor, organizationId);
    await this.savedTaskViewRepository.remove(view);
    return { success: 'success', data: { id } };
  }

  async updateTask(id: number, updateTaskDetails: any, user, organizationId) {
    await this.assertTaskWriteAccess(id, user, organizationId);
    try {
      const userFound = await this.userRepository.findOneBy({
        id: user.userId,
      });
      if (!userFound)
        throw new HttpException(
          'User not found. Cannot create Task',
          HttpStatus.BAD_REQUEST,
        );

      const task = await this.findOne(id);
      if (!task)
        throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);

      const data: CreateTaskParams = {};
      const richDescription = normalizeRichTextDescription({
        description: updateTaskDetails.description,
        description_html: updateTaskDetails.description_html,
      });

      if (richDescription) {
        data.description = richDescription.description;
        data.description_html = richDescription.description_html;
      }

      if (updateTaskDetails.title !== undefined) {
        data.title = updateTaskDetails.title;
      }

      if (updateTaskDetails.priority !== undefined) {
        data.priority = updateTaskDetails.priority;
      }

      if (updateTaskDetails.severity !== undefined) {
        data.severity = updateTaskDetails.severity || null;
      }

      const normalizedDueDate = this.normalizeDueDateInput(
        updateTaskDetails.due_date,
      );
      if (normalizedDueDate !== undefined) {
        data.due_date = normalizedDueDate;
      }

      let statusEntity: Status | null = null;
      if (updateTaskDetails.status) {
        statusEntity = await this.statusRepository.findOne({
          where: { id: Number(updateTaskDetails.status) },
        });
        if (!statusEntity) {
          throw new HttpException('Status not found', HttpStatus.BAD_REQUEST);
        }

        data.status = statusEntity;
      }

      if (Object.keys(data).length === 0) {
        throw new HttpException(
          'No update values provided',
          HttpStatus.BAD_REQUEST,
        );
      }

      const updatedResult = await this.taskRepository.update(
        { id },
        { ...data },
      );

      console.log(updatedResult, 'rererr');

      if (updatedResult.affected < 1) {
        return {
          error: 'error',
          message: 'Task update failed',
        };
      }

      const updatedTask = await this.taskRepository.findOne({
        where: { id },
        relations: ['status', 'project'],
      });

      // Assignee updates: clear if empty ("", null, [], or "[]"), otherwise attach
      if (
        Object.prototype.hasOwnProperty.call(updateTaskDetails, 'assignees')
      ) {
        const raw = updateTaskDetails.assignees;

        const clearAssignees = async () => {
          updatedTask.assignees = [];
          await this.taskRepository.save(updatedTask);
        };

        if (raw === null || raw === undefined) {
          await clearAssignees();
        } else if (typeof raw === 'string') {
          const trimmed = raw.trim();
          if (trimmed === '') {
            await clearAssignees();
          } else {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed) && parsed.length === 0) {
                await clearAssignees();
              } else {
                await this.addAssigneeToTask(
                  userFound,
                  raw,
                  updatedTask,
                  organizationId,
                );
              }
            } catch {
              // Not JSON, treat as non-empty string list
              await this.addAssigneeToTask(
                userFound,
                raw,
                updatedTask,
                organizationId,
              );
            }
          }
        } else if (Array.isArray(raw)) {
          if (raw.length === 0) {
            await clearAssignees();
          } else {
            await this.addAssigneeToTask(
              userFound,
              JSON.stringify(raw),
              updatedTask,
              organizationId,
            );
          }
        } else {
          // Unknown type -> clear to be safe
          await clearAssignees();
        }
      }

      await this.projectActivitiesService.createActivity({
        organization_id: organizationId,
        projectId: updatedTask.project.id,
        userId: userFound.id,
        activityType: ActivityType.TASK_UPDATED,
        description: `${userFound.fullName} updated a task: ${
          updatedTask.title ?? ''
        }`,
        entityType: 'task',
        entityId: updatedTask.id,
        metadata: { taskTitle: updatedTask.title ?? '' },
      });

      const hydratedTask = await this.getHydratedTaskForResponse(id);

      return {
        success: true,
        message: 'Task updated successfully',
        data: hydratedTask,
      };
    } catch (error) {
      console.log(error);
    }

    // return this.taskRepository.update({ id }, { ...updateTaskDetails });
  }

  async updateTaskWithAttachments(
    id: number,
    updateTaskDetails: any,
    files: MulterFile[],
    user: any,
    organizationId: string,
  ) {
    await this.assertTaskWriteAccess(id, user, organizationId);
    const uploadedFiles: Array<{
      originalname: string;
      size: number;
      mimetype?: string;
      filePath: string;
      fileUrl: string;
    }> = [];

    try {
      const existingTask = await this.taskRepository.findOne({
        where: { id },
        relations: ['project'],
      });
      if (!existingTask) {
        throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);
      }

      for (const file of files ?? []) {
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          throw new HttpException(
            'File too large. Max size is 10MB',
            HttpStatus.BAD_REQUEST,
          );
        }

        const filePath = this.storageService.generateFilePath(
          Number(existingTask.project.id),
          Number(existingTask.id),
          file.originalname,
        );
        const fileUrl = await this.storageService.uploadFile(file, filePath);

        uploadedFiles.push({
          originalname: file.originalname,
          size: file.size,
          mimetype:
            this.inferMimeType(file.originalname, file.mimetype ?? null) ??
            undefined,
          filePath,
          fileUrl,
        });
      }

      const taskResult = await this.dataSource.transaction(async (manager) => {
        const userFound = await manager.getRepository(User).findOneBy({
          id: user.userId,
        });
        if (!userFound) {
          throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
        }

        const task = await manager.getRepository(Task).findOne({
          where: { id },
          relations: [
            'project',
            'status',
            'assignees',
            'resources',
            'project.user',
          ],
        });
        if (!task) {
          throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);
        }

        if (
          updateTaskDetails.description !== undefined ||
          updateTaskDetails.description_html !== undefined
        ) {
          const normalizedDescription = normalizeRichTextDescription({
            description: updateTaskDetails.description,
            description_html: updateTaskDetails.description_html,
          });
          task.description = normalizedDescription?.description ?? '';
          task.description_html =
            normalizedDescription?.description_html ?? null;
        }

        if (updateTaskDetails.title !== undefined) {
          task.title = updateTaskDetails.title;
        }

        if (updateTaskDetails.priority !== undefined) {
          task.priority = Number(updateTaskDetails.priority);
        }

        if (updateTaskDetails.severity !== undefined) {
          task.severity = updateTaskDetails.severity || null;
        }

        const normalizedDueDate = this.normalizeDueDateInput(
          updateTaskDetails.due_date,
        );
        if (normalizedDueDate !== undefined) {
          task.due_date = normalizedDueDate;
        }

        if (updateTaskDetails.status) {
          const statusEntity = await manager.getRepository(Status).findOne({
            where: { id: Number(updateTaskDetails.status) },
          });
          if (!statusEntity) {
            throw new HttpException('Status not found', HttpStatus.BAD_REQUEST);
          }

          task.status = statusEntity;
        }

        let addedAssignees: User[] = [];
        if (
          Object.prototype.hasOwnProperty.call(updateTaskDetails, 'assignees')
        ) {
          const assigneeEmails = this.parseAssigneeList(
            updateTaskDetails.assignees,
          );

          if (assigneeEmails.length === 0) {
            task.assignees = [];
          } else {
            const foundUsers = await manager.getRepository(User).find({
              where: assigneeEmails.map((email) => ({ email })),
            });

            const foundByEmail = new Map(
              foundUsers.map((foundUser) => [
                foundUser.email.trim().toLowerCase(),
                foundUser,
              ]),
            );

            const nextAssignees = assigneeEmails
              .map((email) => foundByEmail.get(email))
              .filter((foundUser): foundUser is User => Boolean(foundUser));

            const previousIds = new Set(
              (task.assignees ?? []).map((u) => u.id),
            );
            addedAssignees = nextAssignees.filter(
              (assignee) => !previousIds.has(assignee.id),
            );
            task.assignees = nextAssignees;
          }
        }

        const removeResourceIds = this.parseResourceIdList(
          updateTaskDetails.removeResourceIds,
        );

        const resourcesToRemove =
          removeResourceIds.length > 0
            ? await manager.getRepository(Resource).find({
                where: removeResourceIds.map((resourceId) => ({
                  id: resourceId,
                })),
                relations: ['project', 'createdBy', 'task'],
              })
            : [];

        const removableResources = resourcesToRemove.filter(
          (resource) => Number(resource.task?.id) === Number(task.id),
        );

        await manager.getRepository(Task).save(task);

        const createdResources: Resource[] = [];
        for (const uploadedFile of uploadedFiles) {
          const insertResult = await manager.query(
            `
              INSERT INTO resources
                (title, type, mime_type, url, file_path, file_size, projectId, taskId, createdById, organization_id, createdAt, updatedAt)
              VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), NOW(6))
            `,
            [
              uploadedFile.originalname,
              'file',
              uploadedFile.mimetype ?? null,
              uploadedFile.fileUrl,
              uploadedFile.filePath,
              uploadedFile.size,
              task.project.id,
              task.id,
              userFound.id,
              organizationId,
            ],
          );

          const createdResourceId = Number(insertResult?.insertId);

          await manager.query(
            `
              UPDATE resources
              SET projectId = ?, taskId = ?, createdById = ?, organization_id = ?
              WHERE id = ?
            `,
            [
              task.project.id,
              task.id,
              userFound.id,
              organizationId,
              createdResourceId,
            ],
          );

          const persistedResourceRows = await manager.query(
            `
              SELECT id, projectId, taskId, createdById, organization_id
              FROM resources
              WHERE id = ?
            `,
            [createdResourceId],
          );

          const createdResource = await manager
            .getRepository(Resource)
            .findOne({
              where: { id: createdResourceId },
              relations: ['project', 'task', 'createdBy'],
            });

          if (!createdResource) {
            throw new HttpException(
              'Failed to reload created resource',
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }

          createdResources.push(createdResource);
        }

        if (removableResources.length > 0) {
          await manager.getRepository(Resource).remove(removableResources);
        }

        const updatedTask = await manager.getRepository(Task).findOne({
          where: { id: task.id },
          relations: ['status', 'project', 'assignees'],
        });

        if (updatedTask) {
          updatedTask.resources = await this.loadResourcesForTask(
            manager.getRepository(Resource),
            task.id,
          );
        }

        return {
          userFound,
          task,
          updatedTask,
          addedAssignees,
          removableResources,
          createdResources,
        };
      });

      for (const assignee of taskResult.addedAssignees) {
        await this.notificationService.createNotification(
          taskResult.userFound,
          {
            recipient: assignee,
            sender: taskResult.userFound,
            title: 'Task Assignment',
            message: `${taskResult.userFound.fullName} assigned the task ${taskResult.task.title} to you.`,
            type: NOTIFICATION_TYPES.TASK_ASSIGNMENT,
          },
          organizationId,
        );
      }

      for (const resource of taskResult.removableResources) {
        if (resource.file_path) {
          await this.storageService.deleteFile(resource.file_path);
        }

        await this.projectActivitiesService.createActivity({
          organization_id: resource.organization_id,
          projectId: resource.project.id,
          userId: taskResult.userFound.id,
          activityType: ActivityType.RESOURCE_DELETED,
          description: `${taskResult.userFound.fullName} deleted a resource: ${
            resource.title ?? ''
          }`,
          entityType: 'resource',
          entityId: resource.id,
          metadata: { resourceTitle: resource.title ?? '' },
        });
      }

      for (const resource of taskResult.createdResources) {
        await this.projectActivitiesService.createActivity({
          organization_id: organizationId,
          projectId: taskResult.task.project.id,
          userId: taskResult.userFound.id,
          activityType: ActivityType.RESOURCE_ADDED,
          description: `${taskResult.userFound.fullName} added a resource: ${
            resource.title ?? ''
          }`,
          entityType: 'resource',
          entityId: resource.id,
          metadata: { resourceTitle: resource.title ?? '' },
        });
      }

      await this.projectActivitiesService.createActivity({
        organization_id: organizationId,
        projectId: taskResult.task.project.id,
        userId: taskResult.userFound.id,
        activityType: ActivityType.TASK_UPDATED,
        description: `${taskResult.userFound.fullName} updated a task: ${
          taskResult.task.title ?? ''
        }`,
        entityType: 'task',
        entityId: taskResult.task.id,
        metadata: { taskTitle: taskResult.task.title ?? '' },
      });

      const hydratedTask = await this.getHydratedTaskForResponse(id);

      return {
        success: true,
        message: 'Task updated successfully',
        data: hydratedTask,
      };
    } catch (error) {
      for (const uploadedFile of uploadedFiles) {
        try {
          await this.storageService.deleteFile(uploadedFile.filePath);
        } catch {
          // ignore cleanup failure
        }
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error?.message || 'Failed to update task with attachments',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private parseAssigneeList(raw: unknown): string[] {
    if (raw === null || raw === undefined) {
      return [];
    }

    let values: unknown[] = [];

    if (Array.isArray(raw)) {
      values = raw;
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed || trimmed === '[]') {
        return [];
      }

      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (!Array.isArray(parsed)) {
            throw new Error();
          }
          values = parsed;
        } catch {
          throw new HttpException(
            'Invalid assignees payload',
            HttpStatus.BAD_REQUEST,
          );
        }
      } else if (trimmed.includes(',')) {
        values = trimmed.split(',');
      } else {
        values = [trimmed];
      }
    } else {
      throw new HttpException(
        'Invalid assignees payload',
        HttpStatus.BAD_REQUEST,
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return values
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }

        if (entry && typeof entry === 'object' && 'email' in entry) {
          return String((entry as { email?: unknown }).email ?? '');
        }

        return String(entry ?? '');
      })
      .map((value) => value.trim().toLowerCase())
      .filter((value) => emailRegex.test(value));
  }

  private parseResourceIdList(raw: unknown): number[] {
    if (raw === null || raw === undefined || raw === '') {
      return [];
    }

    if (Array.isArray(raw)) {
      return raw
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    }

    if (typeof raw !== 'string') {
      throw new HttpException(
        'Invalid removeResourceIds payload',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error();
      }

      return parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
    } catch {
      throw new HttpException(
        'Invalid removeResourceIds payload',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async getHydratedTaskForResponse(id: number) {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['project', 'status', 'assignees'],
    });

    if (!task) {
      return null;
    }

    task.resources = await this.loadResourcesForTask(
      this.resourceRepository,
      id,
    );

    return task;
  }

  private async loadResourcesForTask(
    resourceRepository: Repository<Resource>,
    taskId: number,
  ) {
    return resourceRepository
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.createdBy', 'createdBy')
      .leftJoinAndSelect('resource.project', 'project')
      .leftJoinAndSelect('resource.task', 'task')
      .where('resource.taskId = :taskId', { taskId })
      .orderBy('resource.id', 'ASC')
      .getMany();
  }

  async updateTaskStatus(
    taskId: number,
    updateDto: UpdateTaskStatusDto,
    user: any,
    organizationId: string,
  ) {
    await this.assertTaskWriteAccess(taskId, user, organizationId);
    return await this.dataSource.transaction(async (manager) => {
      const userFound = await manager.getRepository(User).findOne({
        where: { id: user.userId },
      });
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Find task with project and status
      const task = await manager.getRepository(Task).findOne({
        where: { id: taskId },
        relations: [
          'status',
          'project',
          'project.user',
          'project.projectPeers',
          'project.projectPeers.user',
          'assignees',
          'user',
        ],
      });
      if (!task)
        throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

      const previousStatus = task.status;

      // if (task.project.user.id !== userFound.id) {
      //   throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
      // }

      // If task is moving to a new status
      if (task.status.id !== updateDto.statusId) {
        const newStatus = await manager.getRepository(Status).findOne({
          where: { id: updateDto.statusId },
        });
        if (!newStatus) {
          throw new HttpException('Status not found', HttpStatus.NOT_FOUND);
        }

        task.status = newStatus;
        await manager.getRepository(Task).save(task);
      }

      await this.bulkUpdateTaskPositions(
        manager,
        updateDto.sourceTaskIds,
        task.project.id,
      );
      await this.bulkUpdateTaskPositions(
        manager,
        updateDto.targetTaskIds,
        task.project.id,
      );

      // Return updated task with relations
      const updatedTask = await manager.getRepository(Task).findOne({
        where: { id: taskId },
        relations: [
          'status',
          'project',
          'project.user',
          'project.projectPeers',
          'project.projectPeers.user',
          'assignees',
          'user',
        ],
      });

      await this.projectActivitiesService.createActivity({
        organization_id: organizationId,
        projectId: updatedTask.project.id,
        userId: userFound.id,
        activityType: ActivityType.STATUS_CHANGE,
        description: `${userFound.fullName} changed task status: ${
          updatedTask.title ?? ''
        } to ${updatedTask.status.title}`,
        entityType: 'task',
        entityId: updatedTask.id,
        metadata: { taskTitle: updatedTask.title ?? '' },
      });

      await this.sendTaskTerminalStatusNotifications({
        actor: userFound,
        previousStatus,
        task: updatedTask,
        organizationId,
      });

      if (!previousStatus.isTerminal && updatedTask.status.isTerminal) {
        await this.recurringTasksService.generateAfterCompletion(
          updatedTask.id,
        );
      }

      return {
        success: true,
        message: 'Task status and order updated successfully',
        data: {
          id: updatedTask.id,
          title: updatedTask.title,
          description: updatedTask.description,
          priority: updatedTask.priority,
          dueDate: updatedTask.due_date,
          status: {
            id: updatedTask.status.id,
            title: updatedTask.status.title,
            color: updatedTask.status.color,
          },
        },
      };
    });
  }

  private async bulkUpdateTaskPositions(
    manager: EntityManager,
    taskIds: number[] | undefined,
    projectId: number,
  ) {
    if (!taskIds || taskIds.length === 0) {
      return;
    }

    const normalizedTaskIds = Array.from(
      new Set(
        taskIds
          .map((taskId) => Number(taskId))
          .filter((taskId) => Number.isInteger(taskId) && taskId > 0),
      ),
    );

    if (normalizedTaskIds.length === 0) {
      return;
    }

    const positionCase = normalizedTaskIds
      .map((taskId, index) => `WHEN ${taskId} THEN ${index}`)
      .join(' ');

    await manager
      .createQueryBuilder()
      .update(Task)
      .set({
        position: () => `CASE id ${positionCase} ELSE position END`,
      })
      .where('id IN (:...taskIds)', { taskIds: normalizedTaskIds })
      .andWhere('project_id = :projectId', { projectId })
      .execute();
  }

  // async updateTaskStatus2(
  //   taskId: number,
  //   updateDto: UpdateTaskStatusDto,
  //   user: any,
  // ) {
  //   try {
  //     const userFound = await this.userRepository.findOne({
  //       where: { id: user.userId },
  //     });

  //     if (!userFound) {
  //       throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
  //     }

  //     // Find the task with its current status
  //     const task = await this.taskRepository.findOne({
  //       where: { id: taskId },
  //       relations: ['status', 'project', 'project.user'],
  //     });

  //     if (!task) {
  //       throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
  //     }

  //     // Verify user has access to this task's project
  //     if (task.project.user.id !== userFound.id) {
  //       throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
  //     }

  //     // Find the new status
  //     const newStatus = await this.statusRepository.findOne({
  //       where: { id: updateDto.statusId },
  //     });

  //     if (!newStatus) {
  //       throw new HttpException('Status not found', HttpStatus.NOT_FOUND);
  //     }

  //     // Update the task's status
  //     await this.taskRepository.update({ id: taskId }, { status: newStatus });

  //     // Update the order of tasks using ONLY the position field
  //     if (updateDto.taskIds && updateDto.taskIds.length > 0) {
  //       await this.updateTaskOrder(updateDto.taskIds);
  //     }

  //     // Get the updated task
  //     const updatedTask = await this.taskRepository.findOne({
  //       where: { id: taskId },
  //       relations: ['status', 'project', 'assignee'],
  //     });

  //     return {
  //       success: true,
  //       message: 'Task status updated successfully',
  //       data: {
  //         id: updatedTask.id,
  //         title: updatedTask.title,
  //         description: updatedTask.description,
  //         priority: updatedTask.priority,
  //         dueDate: updatedTask.due_date,
  //         status: {
  //           id: updatedTask.status.id,
  //           title: updatedTask.status.title,
  //           color: updatedTask.status.color,
  //         },
  //       },
  //     };
  //   } catch (error) {
  //     console.error('Error updating task status:', error);

  //     if (error instanceof HttpException) {
  //       throw error;
  //     }

  //     throw new HttpException(
  //       'Failed to update task status',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  // Update task order using ONLY position field on tasks
  private async updateTaskOrder(taskIds: number[]) {
    try {
      // Update the position field for each task in the order received
      const updatePromises = taskIds.map((taskId, index) =>
        this.taskRepository.update({ id: taskId }, { position: index }),
      );

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating task order:', error);
    }
  }

  async updateTaskPriority(
    id: number,
    priorityStatus: any,
    user: any,
    organizationId: string,
  ): Promise<any> {
    await this.assertTaskWriteAccess(id, user, organizationId);
    try {
      const userFound = await this.userRepository.findOneBy({
        id: user.userId,
      });
      if (!userFound)
        throw new HttpException(
          'User not found. Cannot create Task',
          HttpStatus.BAD_REQUEST,
        );

      const task = this.taskRepository.findOneBy({ id });
      if (!task)
        throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);

      // if(priorityStatus){
      // if(priorityStatus){

      // }
      console.log(
        priorityStatus === true,
        priorityStatus,
        priorityStatus.priority,
      );
      // console.log(priorityStatus, priorityStatus === true ? 1 : 0, 'priorty');
      const updatedResult = await this.taskRepository.update(
        { id },
        { priority: priorityStatus.priority ? 0 : 1 },
      );

      // console.log(updatedResult);

      if (updatedResult.affected < 1) {
        return {
          error: 'error',
          message: 'Task update failed',
        };
      }

      const updatedTask = await this.findOne(id);
      console.log(updatedTask, 'updatedTask');

      await this.projectActivitiesService.createActivity({
        organization_id: organizationId,
        projectId: updatedTask.project.id,
        userId: userFound.id,
        activityType: ActivityType.TASK_UPDATED,
        description: `${userFound.fullName} updated a task  priority status: ${
          updatedTask.title ?? ''
        }`,
        entityType: 'task',
        entityId: updatedTask.id,
        metadata: { taskTitle: updatedTask.title ?? '' },
      });

      return {
        success: 'success',
        message: 'Task updated successfully',
        data: {
          id: updatedTask.id,
          title: updatedTask.title,
          description: updatedTask.description,
          priority: updatedTask.priority,
          dueDate: updatedTask.due_date,
          status: updatedTask.status,
        },
      };
    } catch (err) {
      console.error('Error saving task:', err);
      throw new HttpException(
        'Error saving task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteTask(
    id: number,
    user: any,
    organizationId: string,
  ): Promise<any> {
    await this.assertTaskWriteAccess(id, user, organizationId);
    try {
      const userFound = await this.userRepository.findOneBy({
        id: user.userId,
      });
      if (!userFound)
        throw new HttpException(
          'User not found. Cannot create Task',
          HttpStatus.BAD_REQUEST,
        );

      const task = await this.findOne(id);
      if (!task) {
        return { error: 'error', message: 'Task not found' }; // Or throw a NotFoundException
      }

      await this.taskRepository.delete(id);

      await this.projectActivitiesService.createActivity({
        organization_id: organizationId,
        projectId: task.project.id,
        userId: userFound.id,
        activityType: ActivityType.TASK_DELETED,
        description: `${userFound.fullName} deleted a task: ${
          task.title ?? ''
        }`,
        entityType: 'task',
        entityId: task.id,
        metadata: { taskTitle: task.title ?? '' },
      });

      return { success: 'success', message: 'Task deleted successfully' };
    } catch (err) {
      console.error('Error deleting task:', err);
      throw new HttpException(
        'Error deleting task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // deleteTask(id: number) {
  //   return this.taskRepository.delete({ id });
  // }

  async getProjectTasks(
    id: number,
    actor: AuthUser,
    organizationId: string,
  ): Promise<any> {
    const project = await this.authorizationService.assertProjectAccess({
      actor,
      organizationId,
      projectId: id,
      action: 'read',
    });

    const tasks = await this.taskRepository.find({
      where: {
        project: project,
        organization_id: organizationId,
      },
      relations: ['tags', 'project', 'status', 'assignees'],
    });

    // const taskArray = [];

    // console.log('doesnt work')

    // tasks.forEach((task, index) => {
    //   taskArray[task.id]= task;
    //   console.log('doesnt work')
    // });

    let data = {
      success: 'success',
      data: tasks,
    };

    return data;
  }

  async createTask(
    id: number,
    payload: any,
    user: any,
    organizationId: string,
  ): Promise<any> {
    await this.authorizationService.assertProjectAccess({
      actor: user,
      organizationId,
      projectId: id,
      action: 'write',
    });
    try {
      const userFound = await this.userRepository.findOneBy({
        id: user.userId,
      });
      if (!userFound)
        throw new HttpException(
          'User not found. Cannot create Task',
          HttpStatus.BAD_REQUEST,
        );

      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });

      const {
        title,
        description,
        status,
        priority,
        severity,
        due_date,
        assignees,
      } = payload; // Destructure
      const richDescription = normalizeRichTextDescription({
        description,
        description_html: payload?.description_html,
      });

      const project = await this.projectRepository.findOneBy({ id });
      if (!project)
        return {
          error: 'error',
          message: 'Project not found',
        };

      console.log(
        title,
        description,
        status,
        priority,
        due_date,
        assignees,
        'title, description, status, priority, due_date, assignees',
      );

      // return;

      // Find status entity if provided as id
      let statusEntity: Status | null = null;
      if (status) {
        statusEntity = await this.statusRepository.findOne({
          where: { id: Number(status) },
        });
        if (!statusEntity) {
          throw new HttpException('Status not found', HttpStatus.BAD_REQUEST);
        }
      }

      const normalizedDueDate = this.normalizeDueDateInput(due_date);
      let recurrencePayload = payload?.recurrence;
      if (typeof recurrencePayload === 'string') {
        try {
          recurrencePayload = JSON.parse(recurrencePayload);
        } catch {
          throw new HttpException(
            'Invalid recurrence payload',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const newTask = this.taskRepository.create({
        title,
        description: richDescription?.description ?? '',
        description_html: richDescription?.description_html ?? null,
        status: statusEntity ?? undefined,
        project,
        priority,
        severity: severity || null,
        due_date: normalizedDueDate ?? null,
        organization,
        organization_id: organization.id,
      });

      // console.log(newTask, 'project')

      const savedTask = await this.dataSource.transaction(async (manager) => {
        const task = await manager.getRepository(Task).save(newTask);
        if (recurrencePayload) {
          await this.recurringTasksService.createForTaskInTransaction(
            manager,
            task,
            {
              ...recurrencePayload,
              interval: Number(recurrencePayload.interval ?? 1),
              generate_before_days: Number(
                recurrencePayload.generate_before_days ?? 0,
              ),
              next_due_at: new Date(recurrencePayload.next_due_at),
              end_at: recurrencePayload.end_at
                ? new Date(recurrencePayload.end_at)
                : undefined,
            },
            user,
            organizationId,
          );
        }
        return task;
      });

      // Attach assignees by emails if provided
      if (assignees && typeof assignees === 'string' && assignees.length > 0) {
        await this.addAssigneeToTask(
          userFound,
          assignees,
          newTask,
          organizationId,
        );
      }

      await this.projectActivitiesService.createActivity({
        organization_id: organizationId,
        projectId: project.id,
        userId: userFound.id,
        activityType: ActivityType.TASK_CREATED,
        description: `${userFound.fullName} created a task: ${
          savedTask.title ?? ''
        }`,
        entityType: 'task',
        entityId: savedTask.id,
        metadata: { taskTitle: savedTask.title ?? '' },
      });

      // console.log(savedTask, 'savedtask')
      return {
        success: 'success',
        message: 'Task created successfully',
        data: {
          id: savedTask.id,
          title: savedTask.title,
          description: savedTask.description,
          description_html: savedTask.description_html,
          priority: savedTask.priority,
          due_date: savedTask.due_date,
        },
      };
    } catch (err) {
      console.error('Error saving task:', err);
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        'Error saving task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async addAssigneeToTask(
    user: any,
    emails: string,
    task: Task,
    organizationId: string,
  ): Promise<any> {
    const parseEmailList = (raw: unknown): string[] => {
      if (Array.isArray(raw)) {
        return raw.map((entry) => String(entry ?? ''));
      }

      if (typeof raw !== 'string') {
        throw new HttpException(
          'Invalid assignees payload',
          HttpStatus.BAD_REQUEST,
        );
      }

      const trimmed = raw.trim();
      if (!trimmed) {
        return [];
      }

      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) {
          throw new HttpException(
            'Invalid assignees payload',
            HttpStatus.BAD_REQUEST,
          );
        }

        return parsed.map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }

          if (entry && typeof entry === 'object' && 'email' in entry) {
            return String((entry as { email?: unknown }).email ?? '');
          }

          return String(entry ?? '');
        });
      }

      if (trimmed.includes(',')) {
        return trimmed.split(',');
      }

      return [trimmed];
    };

    try {
      const emailList = parseEmailList(emails);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validEmails = emailList
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => emailRegex.test(e));

      if (validEmails.length === 0) {
        return { success: true };
      }

      const foundUsers = await this.userRepository.find({
        where: validEmails.map((email) => ({ email })),
      });

      const existingAssignees = task.assignees ?? [];
      const existingIds = new Set(existingAssignees.map((u) => u.id));
      const toAdd = foundUsers.filter((u) => !existingIds.has(u.id));
      task.assignees = [...existingAssignees, ...toAdd];

      await this.taskRepository.save(task);

      for (const add of toAdd) {
        await this.notificationService.createNotification(
          user,
          {
            recipient: add,
            sender: user,
            title: 'Task Assignment',
            message: `${user?.fullName} assigned the task ${task?.title} to you.`,
            type: NOTIFICATION_TYPES.TASK_ASSIGNMENT,
          },
          organizationId,
        );
      }

      return {
        success: true,
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }

      throw new HttpException(
        err?.message || 'Failed to assign task',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
