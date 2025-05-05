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
import { Status } from 'src/typeorm/entities/Status';
import { Project } from 'src/typeorm/entities/Project';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    // @InjectRepository(Post) private postRepository: Repository<Post>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(Task) private taskRepository: Repository<Task>,
    @InjectRepository(Status) private statusRepository: Repository<Status>,
  ) {}

  async getTaskById(id: number): Promise<Task | undefined> {
    const task = await this.taskRepository.findOneBy({ id });
    if (!task)
      throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);
    return task;
  }

  async findTasks() {
    const tasks = await this.taskRepository.find({
      relations: ['project', 'tags', 'status'],
    });
    const res = {
      success: 'success',
      message: 'successful',
      data: tasks,
    };

    return res;
  }

  async updateTask(id: number, updateTaskDetails: CreateTaskParams) {
    try {
      const task = await this.taskRepository.findOneBy({ id });
      if (!task)
        throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);

      console.log(task, updateTaskDetails, 'task');
      const data = {
        description: updateTaskDetails.description,
        title: updateTaskDetails.title,
        status: updateTaskDetails.status,
      };

      const updatedResult = await this.taskRepository.update(
        { id },
        { ...data },
      );

      console.log(updatedResult, 'rererr')

      if (updatedResult.affected < 1) {
        return {
          error: 'error',
          message: 'Task update failed',
        };
      }

      const updatedTask = await this.taskRepository.findOne({ where: { id }, relations: ['status', 'project'] });


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

    }

    // return this.taskRepository.update({ id }, { ...updateTaskDetails });
  }

  async updateTaskPriority(id: number, priorityStatus: any): Promise<any> {
    try {
      // console.log('Updating task priority:', id, priorityStatus);

      const task = this.taskRepository.findOneBy({ id });
      if (!task)
        throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);

      // if(priorityStatus){
      // if(priorityStatus){

      // }
      // console.log(
      //   priorityStatus === true,
      //   priorityStatus,
      //   priorityStatus.priority,
      // );
      // console.log(priorityStatus, priorityStatus === true ? 1 : 0, 'priorty');
      const updatedResult = await this.taskRepository.update(
        { id },
        { priority: priorityStatus.priority ? 1 : 0 },
      );

      // console.log(updatedResult);

      if (updatedResult.affected < 1) {
        return {
          error: 'error',
          message: 'Task update failed',
        };
      }

      const updatedTask = await this.taskRepository.findOneBy({ id });
      console.log(updatedTask, 'updatedTask');

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

  async deleteTask(id: number): Promise<any> {
    try {
      const task = await this.taskRepository.findOne({
        where: { id: id },
      });

      if (!task) {
        console.log(task, 'woejowe');
        // throw new HttpException('Status doesnt exist', HttpStatus.INTERNAL_SERVER_ERROR);
        return { error: 'error', message: 'Task not found' }; // Or throw a NotFoundException
      }

      const deletedTask = await this.taskRepository.delete(id);

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

  async createTask(id: number, payload: any): Promise<any> {
    try {
      // const user = await this.userRepository.findOneBy({ id });
      // if (!user)
      //   throw new HttpException(
      //     'User not found. Cannot create Project',
      //     HttpStatus.BAD_REQUEST,
      //   );

      // if(){

      // }

      // const { ...otherTaskDetails } = CreateTaskDetails; // Destructure

      const { title, description, status } = payload.payload; // Destructure

      // console.log(payload, title, description, status)

      // return
      // const statusFound = await this.statusRepository.findOneBy({status: CreateTaskDetails.status});
      // const statusFound = await this.statusRepository.findOne({
      //   where: { status: CreateTaskDetails.status }
      // });
      // if (!statusFound)
      //   throw new HttpException(
      //     'Project not found. Cannot create Task',
      //     HttpStatus.BAD_REQUEST,
      //   );
      // const { payload } = CreateTaskDetails;

      const project = await this.projectRepository.findOneBy({ id });
      if (!project)
        return {
          error: 'error',
          message: 'Project not found',
        };
      // throw new HttpException(
      //   'Project not found. Cannot create Task',
      //   HttpStatus.BAD_REQUEST,
      // );

      // console.log(project, 'project')
      const newTask = this.taskRepository.create({
        title,
        description,
        status,
        project,
      });

      // console.log(newTask, 'project')

      // return
      const savedTask = await this.taskRepository.save(newTask);

      // console.log(savedTask, 'savedtask')
      return {
        success: 'success',
        message: 'Task created successfully',
        data: {
          id: savedTask.id,
          title: savedTask.title,
          description: savedTask.description,
          priority: savedTask.priority,
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
}
