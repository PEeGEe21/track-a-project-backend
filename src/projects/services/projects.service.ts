import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Post } from '../../typeorm/entities/Post';
import { Profile } from '../../typeorm/entities/Profile';
import { User } from '../../typeorm/entities/User';
import { randomBytes } from 'crypto';
import * as moment from 'moment';
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
import { UsersService } from 'src/users/services/users.service';
import { MailingService } from 'src/utils/mailing/mailing.service';
import { json } from 'body-parser';
import { Category } from 'src/typeorm/entities/Category';

@Injectable()
export class ProjectsService {
  constructor(
    private usersService: UsersService,
    private MailingService: MailingService,

    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(Task) private taskRepository: Repository<Task>,
    @InjectRepository(ProjectPeer)
    private projectPeerRepository: Repository<ProjectPeer>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,

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

  async findUserProjects(
    user: any,
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: string,
    due_date?: string,
    group: string = 'all',
  ): Promise<any> {
    // 1. Await the user search result
    const userFound = await this.usersService.getUserAccountById(user.userId);
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    // 2. Use the query builder
    const queryBuilder = this.projectRepository.createQueryBuilder('project');

    // 3. Apply where condition and relations using the query builder
    const projects = await queryBuilder
      .where('project.user.id = :id', { id: userFound.id })
      .leftJoinAndSelect('project.user', 'owner') // Include user relationship
      .leftJoinAndSelect('project.tasks', 'tasks') // Include tasks relationship
      .leftJoinAndSelect('project.tags', 'tags') // Include tasks relationship
      .leftJoinAndSelect('project.categories', 'categories') // Include tasks relationship
      // .leftJoin('projectPeers.user', 'peerUser'); // The peer's user
      .leftJoinAndSelect('project.projectPeers', 'projectPeers')
      .leftJoin('projectPeers.user', 'peerUser', 'peerUser.id = :userId', {
        userId: userFound.id,
      });

    switch (group) {
      case 'my':
        projects.where('owner.id = :userId', { userId: userFound.id });
        break;

      case 'peer':
        projects.where('peerUser.id = :userId', {
          userId: userFound.id,
        });
        break;
      case 'all':
      default:
        projects.where(
          new Brackets(qb => {
            qb.where('owner.id = :userId', { userId: userFound.id })
              .orWhere('projectPeers.user.id = :userId', { userId: userFound.id });
          })
        );
        break;

            
      // case 'all':
      // default:
      //   console.log(search.toLowerCase(), 'heeer')
      //   projects.where('owner.id = :userId', { userId: userFound.id })
      //   .orWhere('projectPeers.user.id = :userId', { userId: userFound.id });
      //   break;
    }

    if (search) {
      const lowered = `%${search.toLowerCase()}%`;
      projects.andWhere(
        `(LOWER(project.title) LIKE :search OR LOWER(project.description) LIKE :search)`,
        { search: lowered },
      );
    }

    // Handle status
    if (status && status !== 'all') {
      const loweredStatus = status.toLowerCase();
      projects.andWhere(
        `LOWER(project.status) = :status`, // assuming you have a `status` column
        { status: loweredStatus },
      );
    }

    // Handle due_date
    if (due_date) {
      // const formattedDueDate = moment(due_date).utc().format('YYYY-MM-DD'); // Make sure it's UTC date
      projects.andWhere(`DATE(project.due_date) = DATE(:due_date)`, {
        due_date: due_date,
      });
    }

    projects.skip((page - 1) * limit); // Apply pagination based on page and limit
    projects.take(limit); // Set the limit for results per page
    projects.orderBy('project.created_at', 'DESC');

    const [result, total] = await projects.getManyAndCount();

    const lastPage = Math.ceil(total / limit);

    return {
      data: result,
      meta: {
        current_page: Number(page),
        from: (page - 1) * limit + 1,
        last_page: lastPage,
        per_page: Number(limit),
        to: (page - 1) * limit + result.length,
        total: total,
      },
      success: 'success',
    };
  }

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

  async deleteProject(user: any, id: number): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const project = await this.projectRepository.findOne({
        where: { id: id, user: { id: userFound.id } },
      });

      if (!project) {
        return { error: 'error', message: 'Project not found' };
      }

      // console.log(project);

      // return;
      await this.projectRepository.delete(id);

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

  async getUserProjects(id: number) {
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

  async createProject(user: any, CreateProjectDetails: any) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      console.log(CreateProjectDetails);
      // return;
      // Parse the incoming category names
      let categoryIds = this.formatParseCategoryIds(
        CreateProjectDetails.category,
      );

      // const categoryArray = JSON.parse(CreateProjectDetails.category || '[]'); // It's a string, parse it into array

      // Get Categories from the database
      let categories = await this.getCategoriesByIds(categoryIds);

      console.log(
        CreateProjectDetails.deadline,
        moment(CreateProjectDetails.deadline).format('YYYY-MM-DD'),
        'testig heree',
      );
      // build payload
      const payload = {
        title: CreateProjectDetails.title,
        description: CreateProjectDetails.description,
        // due_date: moment(CreateProjectDetails.deadline).format('YYYY-MM-DD HH:mm:ss'),
        due_date: moment.utc(CreateProjectDetails.deadline).toDate(),
        // due_date: new Date(CreateProjectDetails.deadline), // map deadline to due_date
        color: CreateProjectDetails.color,
        icon: CreateProjectDetails.icon,
        status: CreateProjectDetails.status,
        user: userFound,
        categories: categories ?? [], // Attach real Category entities here
        // category: categoryArray.join(','), // Save categories also as string (if you want)
      };

      // console.log(payload, 'fde');
      // return;
      // create the project
      const newProject = this.projectRepository.create(payload);

      const savedProject = await this.projectRepository.save(newProject);

      const res = {
        success: 'success',
        message: `Project created successfully`,
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

  async getCategoriesByIds(categoryIds: string[]) {
    let categories: Category[] = [];
    if (categoryIds.length > 0) {
      categories = await this.categoryRepository.find({
        where: categoryIds.map((id) => ({ id: parseInt(id) })),
      });

      if (categories.length !== categoryIds.length) {
        throw new HttpException(
          'Some categories not found',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    return categories;
  }

  formatParseCategoryIds(category: string) {
    let categoryIds: string[] = [];
    if (category) {
      try {
        categoryIds = JSON.parse(category);
      } catch (err) {
        throw new HttpException(
          'Invalid categories format',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return categoryIds;
  }

  generateInviteCode(): string {
    return randomBytes(20).toString('hex').slice(0, 8);
  }

  // async sendProjectInvite(userId: string, projectId: number, peeremails: { emails: string[] }) {
  //   try {
  //     const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['profile'] });
  //     const userProfile = await this.profileRepository.findOne({ where: { user } });

  //     if (!userProfile) {
  //       return {
  //         error: 'error',
  //         message: 'Your user Profile not found, please update your profile'
  //       };
  //     }

  //     const project = await this.projectRepository.findOne({ where: { id: projectId } });

  //     console.log(peeremails.emails, 'peeremails.emails');
  //     for (const userEmail of peeremails.emails) {
  //       const checkUserAccount = await this.usersService.getUserAccountByEmail(userEmail);
  //       const inviteCode = this.generateInviteCode(); // Assuming you have this function

  //       console.log(userEmail, 'emails');

  //       let peerEmail;
  //       let eventLink;
  //       let peerAccount = false;

  //       if (checkUserAccount) {
  //         peerEmail = ` You just received a project from a peer.${user.profile.firstname} ${user.profile.lastname} via the ProjexTrackr platform. Sign in to your account to view received project. ${process.env.PEER_LINK}/auth/login)`;
  //         eventLink = `${process.env.PEER_LINK}/auth/login`;
  //         peerAccount = true;
  //       } else {
  //         peerEmail = ` You just received a project and an invite to join the projextrackr platform from user.${user.profile.firstname} ${user.profile.lastname}. Accept invite and onboard to the project tracking platform to view the project. ${process.env.PEER_LINK}/peerinvites/${inviteCode}/${project.id}`;
  //         eventLink = `${process.env.PEER_LINK}/peerinvites/${inviteCode}/${project.id}`;
  //       }

  //       console.log(userEmail, user, eventLink, peerAccount, peerEmail);
  //       // await this.MailingService.sendPeerProject(userEmail, user, eventLink, peerAccount, peerEmail);
  //     }

  //     return 'Success'; // Assuming you want to return a success message
  //   } catch (error) {
  //     console.error('An error occurred:', error);
  //     return {
  //       error: 'error',
  //       message: 'An error occurred while sending project invites'
  //     };
  //   }
  // }

  async sendProjectInvite(userId: number, projectId: number, emails: any[]) {
    // const {emails } = peeremails

    // const peeremails = json.parse(emails);
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['profile'],
      });
      const userProfile = await this.profileRepository.findOne({
        where: { user: user },
      });

      if (!userProfile) {
        return {
          error: 'error',
          message: 'Your user Profile not found, please update your profile',
        };
      }

      const project = await this.projectRepository.findOne({
        where: { id: projectId },
      });

      console.log(emails, 'peeremails.emails');
      // for (const userEmail of emails) {
      //   console.log(userEmail, 'here')
      // }
      for (const userEmail of emails) {
        console.log(userEmail, 'emails');

        const checkUserAccount =
          await this.usersService.getUserAccountByEmail(userEmail);

        const inviteCode = this.generateInviteCode(); // Assuming you have this function

        console.log(inviteCode, userEmail, checkUserAccount, 'emails');

        let peerEmail;
        let eventLink;
        let peerAccount = false;

        if (checkUserAccount) {
          peerEmail = `You just received a project from a peer.${user.profile.firstname} ${user.profile.lastname} via the ProjexTrackr platform. Sign in to your account to view received project. ${process.env.PEER_LINK_MAIN}/auth/login)`;
          eventLink = `${process.env.PEER_LINK_MAIN}/auth/login`;
          peerAccount = true;
        } else {
          peerEmail = `You just received a project and an invite to join the projextrackr platform from user.${user.profile.firstname} ${user.profile.lastname}. Accept invite and onboard to the project tracking platform to view the project. ${process.env.PEER_LINK_MAIN}/peerinvites/${inviteCode}/${project.id}`;
          eventLink = `${process.env.PEER_LINK_MAIN}/peerinvites/${inviteCode}/${project.id}`;
        }

        const sentEmail = await this.MailingService.sendPeerProject(
          userEmail,
          user,
          eventLink,
          peerAccount,
          peerEmail,
        );
      }
      return {
        success: 'success',
        message: 'Project invites sent successfully',
      };
    } catch (err) {
      console.log(err);
      return {
        error: 'error',
        message: 'An error occurred while sending project invites',
      };
    }
  }
}
