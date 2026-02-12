import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class TasksService {
  constructor(
    private dataSource: DataSource,
    private notificationService: NotificationsService,
    private projectActivitiesService: ProjectActivitiesService,

    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    // @InjectRepository(Post) private postRepository: Repository<Post>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(Task) private taskRepository: Repository<Task>,
    @InjectRepository(Status) private statusRepository: Repository<Status>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

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

  async getTaskById(id: number): Promise<Task | undefined> {
    const task = await this.taskRepository.findOneBy({ id });
    if (!task)
      throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);
    return task;
  }

  async findTasks() {
    const tasks = await this.taskRepository.find({
      relations: ['project', 'tags', 'status', 'assignees'],
    });
    const res = {
      success: 'success',
      message: 'successful',
      data: tasks,
    };

    return res;
  }

  async updateTask(id: number, updateTaskDetails: any, user, organizationId) {
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

      console.log(task, updateTaskDetails, 'task');
      const data: CreateTaskParams = {
        description: updateTaskDetails.description,
        title: updateTaskDetails.title,
        priority: updateTaskDetails.priority,
        due_date: updateTaskDetails.due_date,
      };

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
              organizationId
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
    } catch (error) {
      console.log(error);
    }

    // return this.taskRepository.update({ id }, { ...updateTaskDetails });
  }

  async updateTaskStatus(
    taskId: number,
    updateDto: UpdateTaskStatusDto,
    user: any,
    organizationId: string,
  ) {
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
        relations: ['status', 'project', 'project.user'],
      });
      if (!task)
        throw new HttpException('Task not found', HttpStatus.NOT_FOUND);

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

      // Reorder tasks in source column (if provided)
      if (updateDto.sourceTaskIds && updateDto.sourceTaskIds.length > 0) {
        await Promise.all(
          updateDto.sourceTaskIds.map((id, index) =>
            manager.getRepository(Task).update({ id }, { position: index }),
          ),
        );
      }

      // Reorder tasks in target column (if provided)
      if (updateDto.targetTaskIds && updateDto.targetTaskIds.length > 0) {
        await Promise.all(
          updateDto.targetTaskIds.map((id, index) =>
            manager.getRepository(Task).update({ id }, { position: index }),
          ),
        );
      }

      // Return updated task with relations
      const updatedTask = await manager.getRepository(Task).findOne({
        where: { id: taskId },
        relations: ['status', 'project', 'assignees'],
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

  async getProjectTasks(id: number): Promise<any> {
    const project = await this.projectRepository.findOneBy({ id });
    if (!project)
      throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

    const tasks = await this.taskRepository.find({
      where: {
        project: project,
      },
      relations: ['tags', 'projects', 'status'],
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

      const { title, description, status, priority, due_date, assignees } =
        payload; // Destructure

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

      const newTask = this.taskRepository.create({
        title,
        description,
        status: statusEntity ?? undefined,
        project,
        priority,
        due_date,
        organization,
        organization_id: organization.id,
      });

      // console.log(newTask, 'project')

      const savedTask = await this.taskRepository.save(newTask);

      // Attach assignees by emails if provided
      if (assignees && typeof assignees === 'string' && assignees.length > 0) {
        await this.addAssigneeToTask(userFound, assignees, newTask, organizationId);
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
          priority: savedTask.priority,
          due_date: savedTask.due_date,
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

  async addAssigneeToTask(
    user: any,
    emails: string,
    task: Task,
    organizationId: string,
  ): Promise<any> {
    try {
      const emailList: string[] = Array.isArray(emails)
        ? (emails as unknown as string[])
        : JSON.parse(emails);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validEmails = emailList
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => emailRegex.test(e));

      if (validEmails.length === 0) return;

      // Load users by emails
      const foundUsers = await this.userRepository.find({
        where: validEmails.map((email) => ({ email })),
      });

      // Attach found users as assignees (avoid duplicates)
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
      throw new HttpException(
        'Invalid assignees payload',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
