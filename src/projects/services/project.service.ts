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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(Post) private postRepository: Repository<Post>,
  ) {}

  async getProjectById(id: number): Promise<Project | undefined> {
    const project = await this.projectRepository.findOneBy({ id });
    return project;
  }


  findProjects() {
    return this.projectRepository.find({ relations: ['user', 'tasks'] });
  }

  updateProject(id: number, updateProjectDetails: CreateProjectParams) {
    return this.projectRepository.update({ id }, { ...updateProjectDetails });
  }

  deleteProject(id: number) {
    return this.projectRepository.delete({ id });
  }

  async createProject(id: string, CreateProjectDetails: CreateProjectParams) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user)
      throw new HttpException(
        'User not found. Cannot create Project',
        HttpStatus.BAD_REQUEST,
      );
    const newPost = this.projectRepository.create({
      ...CreateProjectDetails,
      user,
    });
    return this.projectRepository.save(newPost);
  }
}
