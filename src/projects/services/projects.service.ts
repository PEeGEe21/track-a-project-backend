import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../../typeorm/entities/Post';
import { Profile } from '../../typeorm/entities/Profile';
import { User } from '../../typeorm/entities/User';
import {
  CreateProjectParams,
  CreateUserParams,
  CreateUserPostParams,
  CreateUserProfileParams,
  UpdateUserParams,
} from '../../utils/types';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeers';
import { Task } from 'src/typeorm/entities/Task';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(Task) private taskRepository: Repository<Task>,
    @InjectRepository(ProjectPeer)
    private projectPeerRepository: Repository<ProjectPeer>,

    // @InjectRepository(Post) private postRepository: Repository<Post>,
  ) {}

  async getProjectById(id: number): Promise<any | undefined> {
    try {
      const project = await this.projectRepository.findOneBy({ id });
      if (!project)
        throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

      const project_tasks = await this.taskRepository.find({
        where: { project: project },
      });

      project.tasks = project_tasks;

      let data = {
        project,
        tasks: project_tasks,
        success: 'success',
      };
      return data;
    } catch (err) {}
  }

  async findProjects() {
    const projects = await this.projectRepository.find({
      relations: ['user', 'tasks'],
    });

    const res = {
      success: 'success',
      message: 'successful',
      data: projects,
    };
    return res;
  }

  // async findProjectsByUserId(userId: string, page: number = 1, limit: number = 10): Promise<{
  //   data: Project[];
  //   nextPage?: number;
  // }> {
  //   console.log('heree')

  //   const userFound = this.userRepository.findOneBy({id: userId});

  //   console.log(userFound, 'user')
  //   const queryBuilder = this.projectRepository.createQueryBuilder('project');

  //   const projects = await this.projectRepository.find({
  //     where: {user : userFound},
  //     relations: ['user', 'tasks'],
  //   });

  //   queryBuilder
  //     // .where('project.user.id = :userId', { userId })
  //     // .leftJoinAndSelect('project.user', 'user') // Include user relationship
  //     // .leftJoinAndSelect('project.tasks', 'tasks') // Include tasks relationship
  //     // .skip((page - 1) * limit) // Apply pagination based on page and limit
  //     // .take(limit); // Set the limit for results per page

  //   // const [projects, total] = await queryBuilder.getManyAndCount();

  //   const nextPage = total > page * limit ? page + 1 : undefined;

  //   console.log(nextPage, 'eeeeerrere');
  //   return {
  //     data: projects,
  //     nextPage,
  //   };
  // }

  async findProjectsByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {
    console.log('heree');

    // 1. Await the user search result
    const userFound = await this.userRepository.findOneBy({ id: userId });

    console.log(userFound, 'user');

    // 2. Use the query builder
    const queryBuilder = this.projectRepository.createQueryBuilder('project');

    // 3. Apply where condition and relations using the query builder
    const projects = await queryBuilder
      .where('project.user.id = :userId', { userId })
      .leftJoinAndSelect('project.user', 'user') // Include user relationship
      .leftJoinAndSelect('project.tasks', 'tasks') // Include tasks relationship
      .skip((page - 1) * limit) // Apply pagination based on page and limit
      .take(limit) // Set the limit for results per page
      .orderBy('project.createdAt', 'DESC')
      .getMany(); // Execute the query

    // Calculate next page based on total count and pagination
    const total = await queryBuilder.getCount();
    console.log(total, projects, 'total');
    const nextPage = total > page * limit ? page + 1 : undefined;

    console.log(nextPage, 'eeeeerrere');

    return {
      data: projects,
      nextPage,
      success: 'success',
    };
  }

  // updateProject(id: number, updateProjectDetails: CreateProjectParams) {
  //   return this.projectRepository.update({ id }, { ...updateProjectDetails });
  // }

  async updateProject(id: number, updateProjectDetails: CreateProjectParams) {
    try {
      console.log(id);
      const project = await this.projectRepository.findOneBy({ id });
      if (!project)
        throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

      console.log(project, updateProjectDetails, 'Project');
      const data = {
        description: updateProjectDetails.description,
        title: updateProjectDetails.title,
      };

      const updatedResult = await this.projectRepository.update(
        { id },
        { ...data },
      );

      console.log(updatedResult, 'rererr');

      if (updatedResult.affected < 1) {
        return {
          error: 'error',
          message: 'Project update failed',
        };
      }

      const updatedProject = await this.projectRepository.findOne({
        where: { id },
        relations: ['user'],
      });

      return {
        success: 'success',
        message: 'Project updated successfully',
        data: {
          id: updatedProject.id,
          title: updatedProject.title,
          description: updatedProject.description,
        },
      };
    } catch (error) {}

    // return this.taskRepository.update({ id }, { ...updateTaskDetails });
  }

  // deleteProject(id: number) {
  //   return this.projectRepository.delete({ id });
  // }

  async deleteProject(id: number): Promise<any> {
    try {
      const project = await this.projectRepository.findOne({
        where: { id: id },
      });

      if (!project) {
        return { error: 'error', message: 'Project not found' };
      }

      const deletedProject = await this.projectRepository.delete(id);

      return { success: 'success', message: 'Project deleted successfully' };
    } catch (err) {
      console.error('Error deleting project:', err);
      throw new HttpException(
        'Error deleting project',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // async getUserProjectsPeer(userId: string, projectId: string) {
  //   const user = await this.userRepository.findOneBy({ userId });
  //   if (!user)
  //     throw new HttpException('User not found', HttpStatus.BAD_REQUEST);

  //   const projects = await this.projectRepository.find({
  //     where: {
  //       user: user,
  //     },
  //     relations: ['user', 'tasks'],
  //   });

  //   let data = {
  //     success: 'success',
  //     data: projects,
  //   };
  //   return data;
  // }

  async getProjectsPeer(id: number) {
    const project = await this.projectRepository.findOneBy({ id });
    if (!project)
      throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

    const project_peers = await this.projectPeerRepository.find({
      where: {
        project: project,
      },
      relations: ['user'],
    });

    let data = {
      success: 'success',
      data: project_peers,
    };

    return data;
  }

  async getProjectTasks(id: number): Promise<any> {
    // console.log(id);
    const project = await this.projectRepository.findOneBy({ id });
    if (!project)
      throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

    const tasks = await this.taskRepository.find({
      where: {
        project: project,
      },
      relations: ['tags', 'project', 'status'],
    });

    let resp = {
      success: 'success',
      data: tasks,
    };
    console.log(resp);
    return resp;
  }

  async getUserProjects(id: string) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user)
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);

    delete user.password;

    const projects = await this.projectRepository.find({
      where: {
        user: user,
      },
      relations: ['user', 'tasks'],
    });

    let data = {
      success: 'success',
      data: projects,
    };
    return data;
  }

  async createProject(id: string, CreateProjectDetails: CreateProjectParams) {
    try {
      const user = await this.userRepository.findOneBy({ id });

      if (!user) {
        throw new HttpException(
          'User not found. Cannot create Project',
          HttpStatus.BAD_REQUEST,
        );
      }

      const newProject = this.projectRepository.create({
        ...CreateProjectDetails,
        user,
      });

      const savedProject = await this.projectRepository.save(newProject);

      const res = {
        success: 'successfull',
        message: `${savedProject.title} Project created successfully`,
        data: savedProject,
      };

      return res;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      } else {
        throw new HttpException(
          'Internal Server Error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }
}
