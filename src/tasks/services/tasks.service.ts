import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
import { Project } from 'src/typeorm/entities/Project';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    // @InjectRepository(Post) private postRepository: Repository<Post>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(Task) private taskRepository: Repository<Task>,
  ) {}

  async getTaskById(id: number): Promise<Task | undefined> {
    const task = await this.taskRepository.findOneBy({ id });
    if (!task)
      throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);
    return task;
  }

  async findTasks() {
    const tasks = await this.taskRepository.find({
      relations: ['project', 'tags'],
    });
    const res = {
      success: 'success',
      message: 'successful',
      data: tasks,
    };

    return res;
  }

  updateTask(id: number, updateTaskDetails: CreateTaskParams) {
    const task = this.taskRepository.findOneBy({ id });
    if (!task)
      throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);
    return this.projectRepository.update({ id }, { ...updateTaskDetails });
  }

  deleteTask(id: number) {
    return this.taskRepository.delete({ id });
  }

  async getProjectTasks(id: number): Promise<any> {
    const project = await this.projectRepository.findOneBy({ id });
    if (!project)
      throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

    const tasks = await this.taskRepository.find({
      where: {
        project: project,
      },
      relations: ['tags', 'projects'],
    });

    let data = {
      success: 'success',
      data: tasks,
    };
    return data;
  }

  async createTask(
    id: number,
    CreateTaskDetails: CreateTaskParams,
  ): Promise<any> {
    // const user = await this.userRepository.findOneBy({ id });
    // if (!user)
    //   throw new HttpException(
    //     'User not found. Cannot create Project',
    //     HttpStatus.BAD_REQUEST,
    //   );

    const project = await this.projectRepository.findOneBy({ id });
    if (!project)
      throw new HttpException(
        'Project not found. Cannot create Task',
        HttpStatus.BAD_REQUEST,
      );
    const newTask = this.taskRepository.create({
      ...CreateTaskDetails,
      project,
    });

    return this.taskRepository.save(newTask);
  }
}
