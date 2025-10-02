import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../../typeorm/entities/Post';
import { Profile } from '../../typeorm/entities/Profile';
import { User } from '../../typeorm/entities/User';
import {
  CreateStatusParams,
  CreateTaskParams,
  CreateUserParams,
  CreateUserPostParams,
  CreateUserProfileParams,
  UpdateUserParams,
} from '../../utils/types';
import { Task } from 'src/typeorm/entities/Task';
import { Project } from 'src/typeorm/entities/Project';
import { Status } from 'src/typeorm/entities/Status';

@Injectable()
export class StatusService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    // @InjectRepository(Post) private postRepository: Repository<Post>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(Task) private taskRepository: Repository<Task>,
    @InjectRepository(Status) private statusRepository: Repository<Status>,
  ) {}

  async getTaskById(id: number): Promise<Status | undefined> {
    const task = await this.statusRepository.findOneBy({ id });
    if (!task)
      throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);
    return task;
  }

  async getTasksAndColumns(
    projectId: Project,
  ): Promise<{ tasks: Task[]; columns: Status[] }> {
    const tasks = await this.taskRepository.find({
      relations: ['column'],
      where: { project: projectId },
    });
    const columns = await this.statusRepository.find({ relations: ['tasks'] });

    return { tasks, columns };
  }

  async findStatuses(user: any): Promise<any> {
    const userFound = await this.userRepository.findOne({
      where: { id: user.userId },
    });
    if (!userFound)
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);

    const statuses = await this.statusRepository.find({
      where: {
        user: { id: userFound.id },
      },
      relations: ['tasks', 'tasks.project', 'tasks.status'],
    });

    console.log(statuses, 'statusesstatuses');

    const statusData = statuses.map((status) => ({
      id: status.id,
      title: status.title,
      color: status.color,
      description: status.description,
      // other status properties
      // taskhhs: status.tasks,
      taskIds: status.tasks.map((task) => task.id),
      // tasks: status.tasks.filter((task) => task.project?.id === project.id),
      // taskIds: status.tasks
      //   .filter((task) => task.project?.id === project.id)
      //   .map((task) => task.id),
    }));

    console.log(statusData, 'statusData')

    const res = {
      success: 'success',
      message: 'successful',
      data: statusData,
    };

    return res;
  }

  async findStatuses2(userId: string, projectId: number): Promise<any> {
    const user = await this.userRepository.findOneById(userId);
    if (!user)
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);

    const project = await this.projectRepository.findOneById(projectId);
    console.log(project);
    if (!project)
      throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

    const statuses = await this.statusRepository.find({
      where: {
        user: user,
      },
      relations: ['tasks', 'tasks.project', 'tasks.status'],
    });

    // const statuses = await this.statusRepository.createQueryBuilder('status')
    // .leftJoinAndSelect('status.tasks', 'task')
    // .where('status.user = :user', { user })
    // .andWhere('task.project_id = :projectId', { projectId: 2 })
    // .getMany();

    const statusData = statuses.map((status) => ({
      id: status.id,
      title: status.title,
      description: status.description,
      // other status properties
      // taskhhs: status.tasks,
      // taskIds: status.tasks.map((task) => task.id),
      tasks: status.tasks.filter((task) => task.project?.id === project.id),
      taskIds: status.tasks
        .filter((task) => task.project?.id === project.id)
        .map((task) => task.id),
    }));

    const res = {
      success: 'success',
      message: 'successful',
      data: statusData,
    };

    return res;
  }

  async updateStatus(
    id: number,
    updateStatusDetails: CreateStatusParams,
  ): Promise<any> {
    try {
      const status = await this.statusRepository.findOneBy({ id });
      if (!status)
        throw new HttpException('Status not found', HttpStatus.BAD_REQUEST);

      const updatedResult = await this.statusRepository.update(
        { id },
        { ...updateStatusDetails },
      );

      if (updatedResult.affected > 0) {
        // Status likely updated (check documentation for confirmation)
        const updatedStatus = await this.statusRepository.findOneBy({ id }); // Fetch updated status
        return {
          success: 'success',
          message: 'Status updated successfully',
          data: {
            id: updatedStatus.id,
            title: updatedStatus.title,
            description: updatedStatus.description,
            tasks: updatedStatus.tasks,
          },
        };
        // ... (use updatedStatus or handle error if not found)
      } else {
        return {
          error: 'error',
          message: 'An Error Occured',
        };
      }
    } catch (err) {
      console.error('Error deleting status:', err);
      throw new HttpException(
        'Error deleting status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteStatus(id: number, type: number): Promise<any> {
    try {
      const existingStatus = await this.statusRepository.findOne({
        where: { id: id },
        relations: ['user', 'tasks'],
      });

      if (!existingStatus) {
        console.log(existingStatus, 'woejowe');
        // throw new HttpException('Status doesnt exist', HttpStatus.INTERNAL_SERVER_ERROR);
        return { error: 'error', message: 'Status not found' }; // Or throw a NotFoundException
      }

      const existingTasks = await this.taskRepository.find({
        where: { status: existingStatus },
      });

      console.log(existingTasks, type, existingStatus);
      // return
      if (type === 0) {
        await this.statusRepository.delete(id);
        if (existingTasks.length > 0) {
          await Promise.all(
            existingTasks.map(async (task) => {
              // if (task.type === 0) {
              // await this.taskRepository.delete(task);
              // }
            }),
          );
        }
      } else {
        const existingStatus2 = await this.statusRepository.find({
          where: { user: existingStatus.user },
        });

        if (existingStatus2.length > 0 && existingTasks.length > 0) {
          await Promise.all(
            existingTasks.map(async (task) => {
              // if (task.type === 0) {
              task.status = existingStatus2[0];
              await this.taskRepository.save(task);

              // }
            }),
          );
        }

        await this.statusRepository.delete(id);
      }

      return { success: 'success', message: 'Status deleted successfully' };
    } catch (err) {
      console.error('Error deleting status:', err);
      throw new HttpException(
        'Error deleting status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createStatus(
    id: number,
    CreateStatusDetails: CreateStatusParams,
  ): Promise<any> {
    try {
      const user = await this.userRepository.findOneBy({ id });
      if (!user)
        throw new HttpException(
          'User not found. Cannot create Project',
          HttpStatus.BAD_REQUEST,
        );

      const existingStatus = await this.statusRepository.findOne({
        where: { title: CreateStatusDetails.title, user: user },
      });
      if (existingStatus) {
        const res = {
          error: 'error',
          message: 'Status already exists',
        };

        return res;
      }
      // const project = await this.projectRepository.findOneBy({ id });
      // if (!project)
      //   throw new HttpException(
      //     'Project not found. Cannot create Task',
      //     HttpStatus.BAD_REQUEST,
      //   );
      const newStatus = this.statusRepository.create({
        ...CreateStatusDetails,
        user,
      });

      const savedStatus = await this.statusRepository.save(newStatus);

      return {
        success: 'success',
        message: 'Status created successfully',
        data: {
          id: savedStatus.id,
          title: savedStatus.title,
          description: savedStatus.description,
          tasks: [],
        },
      };
    } catch (error) {
      // Handle database or other errors during save
      throw new HttpException(
        'Error creating status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
