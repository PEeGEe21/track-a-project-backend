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

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(ProjectPeer)
    private projectPeerRepository: Repository<ProjectPeer>,

    // @InjectRepository(Post) private postRepository: Repository<Post>,
  ) {}

  async getProjectById(id: number): Promise<any | undefined> {
    const project = await this.projectRepository.findOneBy({ id });
    if (!project)
      throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

    // if()
    let data = {
      project,
      success: "sucess"
    }
    return data;
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

  updateProject(id: number, updateProjectDetails: CreateProjectParams) {
    return this.projectRepository.update({ id }, { ...updateProjectDetails });
  }

  deleteProject(id: number) {
    return this.projectRepository.delete({ id });
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
