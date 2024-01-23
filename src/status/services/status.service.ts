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

  async getTasksAndColumns(projectId: Project): Promise<{ tasks: Task[]; columns: Status[] }> {
    const tasks = await this.taskRepository.find({ relations: ['column'], where: { project: projectId } });
    const columns = await this.statusRepository.find({ relations: ['tasks'] });

    return { tasks, columns };
  }

  async findStatuses(userId: string): Promise<any> {

    const user = await this.userRepository.findOneById(userId);
    if (!user)
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);

    const statuses = await this.statusRepository.find({
     where: {
        user: user,
      }, relations: ['tasks'], 
    });

    const res = {
      success: 'success',
      message: 'successful',
      data: statuses,
    };

    return res;
  }

  updateStatus(id: number, updateStatusDetails: CreateStatusParams) {
    const status = this.statusRepository.findOneBy({ id });
    if (!status)
      throw new HttpException('Status not found', HttpStatus.BAD_REQUEST);
    return this.statusRepository.update({ id }, { ...updateStatusDetails });
  }

  deleteStatus(id: number) {
    return this.statusRepository.delete({ id });
  }


  async createStatus(
    id: string,
    CreateStatusDetails: CreateStatusParams,
  ): Promise<any> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user)
      throw new HttpException(
        'User not found. Cannot create Project',
        HttpStatus.BAD_REQUEST,
      );

    // const project = await this.projectRepository.findOneBy({ id });
    // if (!project)
    //   throw new HttpException(
    //     'Project not found. Cannot create Task',
    //     HttpStatus.BAD_REQUEST,
    //   );
    const newTask = this.statusRepository.create({
      ...CreateStatusDetails,
      user
    });

    return this.statusRepository.save(newTask);
  }
}
