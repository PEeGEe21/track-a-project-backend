import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, Repository } from 'typeorm';
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
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Task } from 'src/typeorm/entities/Task';
import { UsersService } from 'src/users/services/users.service';
import { MailingService } from 'src/utils/mailing/mailing.service';
import { json } from 'body-parser';
import { Category } from 'src/typeorm/entities/Category';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { addDays, addHours } from 'date-fns';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { ProjectPeerInvite } from 'src/typeorm/entities/ProjectPeerInvite';
import { NOTIFICATION_TYPES } from 'src/utils/constants/notifications';
import { NotificationsService } from 'src/notifications/services/notifications.service';
import { ProjectComment } from 'src/typeorm/entities/ProjectComment';
import { ProjectsGateway } from '../projects.gateway';
import { UserPeerStatus } from 'src/utils/constants/userPeerEnums';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { Status } from 'src/typeorm/entities/Status';

const TAG_REGEX = /@(\w+)/g;

function extractMentions(message: string): string[] {
  const mentions = [];
  let match;
  while ((match = TAG_REGEX.exec(message)) !== null) {
    mentions.push(match[1]); // username without @
  }
  return mentions;
}

@Injectable()
export class ProjectsService {
  constructor(
    private usersService: UsersService,
    private MailingService: MailingService,
    private notificationService: NotificationsService,
    private projectGateway: ProjectsGateway,
    // @Inject(forwardRef(() => ProjectsGateway)) private projectGateway: ProjectsGateway, // Use forwardRef here
    @InjectEntityManager() private entityManager: EntityManager,

    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Profile) private profileRepository: Repository<Profile>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(Task) private taskRepository: Repository<Task>,
    @InjectRepository(ProjectPeer)
    private projectPeerRepository: Repository<ProjectPeer>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(UserPeer)
    private userPeerRepository: Repository<UserPeer>,
    @InjectRepository(UserPeerInvite)
    private userPeerInviteRepository: Repository<UserPeerInvite>,
    @InjectRepository(ProjectPeerInvite)
    private projectPeerInviteRepository: Repository<ProjectPeerInvite>,
    @InjectRepository(ProjectComment)
    private projectCommentRepository: Repository<ProjectComment>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,

    // @InjectRepository(Post) private postRepository: Repository<Post>,
  ) {}

  async getProjectById(id: number, user: any): Promise<any | undefined> {
    try {
      const project = await this.projectRepository.findOne({
        where: { id },
        relations: ['tasks', 'tasks.tags', 'tasks.status'],
      });

      if (!project)
        throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

      let data = {
        project,
        tasks: project.tasks,
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

  async findUserProjects(
    user: any,
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: string,
    due_date?: string,
    group: string = 'all',
  ): Promise<any> {
    try {
      // 1. Await the user search result
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // 2. Use the query builder
      const queryBuilder = this.projectRepository.createQueryBuilder('project');

      // 1. Select project fields (all fields by default)
      queryBuilder.select('project');

      // 2. Join owner (exclude sensitive fields)
      queryBuilder.leftJoin('project.user', 'owner').addSelect([
        'owner.id',
        'owner.first_name',
        'owner.last_name',
        'owner.email',
        'owner.avatar',
        // add any other owner fields you DO want
      ]);

      // 3. Join tasks, tags, categories (fully)
      queryBuilder
        .leftJoinAndSelect('project.tasks', 'tasks')
        .leftJoinAndSelect('tasks.status', 'status') // ✅ Reference the 'tasks' alias
        .leftJoin('tasks.assignees', 'assignees')
        .addSelect([
          'assignees.id',
          'assignees.first_name',
          'assignees.last_name',
          'assignees.email',
          'assignees.avatar',
        ])
        .leftJoinAndSelect('project.tags', 'tags')
        .leftJoinAndSelect('project.categories', 'categories');

      // 4. Join project peers + peer users (exclude sensitive peer fields)
      queryBuilder
        .leftJoinAndSelect('project.projectPeers', 'projectPeers')
        .leftJoin('projectPeers.user', 'peerUsers')
        .addSelect([
          'peerUsers.id',
          'peerUsers.first_name',
          'peerUsers.last_name',
          'peerUsers.email',
          'peerUsers.avatar',
          // add other peer fields you DO want
        ]);

      // 3. Apply joins and relations cleanly
      // queryBuilder
      //   .leftJoinAndSelect('project.user', 'owner') // project owner
      //   .leftJoinAndSelect('project.tasks', 'tasks')
      //   .leftJoinAndSelect('project.tags', 'tags')
      //   .leftJoinAndSelect('project.categories', 'categories')
      //   .leftJoinAndSelect('project.projectPeers', 'projectPeers')
      //   .leftJoinAndSelect('projectPeers.user', 'peerUsers'); // <-- select peer users properly

      // 4. Apply group conditions cleanly
      switch (group) {
        case 'my':
          queryBuilder.where('owner.id = :userId', { userId: userFound.id });
          break;

        case 'peer':
          queryBuilder.where((qb) => {
            const subQuery = qb
              .subQuery()
              .select('pp.project_id')
              .from('project_peers', 'pp')
              .where('pp.user_id = :userId', { userId: userFound.id })
              .getQuery();
            return 'project.id IN ' + subQuery;
          });
          // queryBuilder.where('peerUsers.id = :userId', {
          //   userId: userFound.id,
          // });
          break;

        case 'all':
        default:
          queryBuilder.where(
            new Brackets((qb) => {
              qb.where('owner.id = :userId', { userId: userFound.id }).orWhere(
                (subQb) => {
                  const subQuery = subQb
                    .subQuery()
                    .select('pp.project_id')
                    .from('project_peers', 'pp')
                    .where('pp.user_id = :userId', { userId: userFound.id })
                    .getQuery();
                  return 'project.id IN ' + subQuery;
                },
              );
            }),
          );
          // queryBuilder.where(
          //   new Brackets((qb) => {
          //     qb.where('owner.id = :userId', { userId: userFound.id }).orWhere(
          //       'peerUsers.id = :userId',
          //       { userId: userFound.id },
          //     );
          //   }),
          // );
          break;
      }

      // 5. Search filter
      if (search) {
        const lowered = `%${search.toLowerCase()}%`;
        queryBuilder.andWhere(
          `(LOWER(project.title) LIKE :search OR LOWER(project.description) LIKE :search)`,
          { search: lowered },
        );
      }

      // 6. Status filter
      if (status && status !== 'all') {
        const loweredStatus = status.toLowerCase();
        queryBuilder.andWhere(`LOWER(project.status) = :status`, {
          status: loweredStatus,
        });
      }

      // 7. Due date filter
      if (due_date) {
        queryBuilder.andWhere(`DATE(project.due_date) = DATE(:due_date)`, {
          due_date: due_date,
        });
      }

      // 8. Pagination and ordering
      queryBuilder.skip((page - 1) * limit);
      queryBuilder.take(limit);
      queryBuilder.orderBy('project.created_at', 'DESC');

      // 9. Execute query
      const [result, total] = await queryBuilder.getManyAndCount();
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
    } catch (error) {
      console.error('Error fetching user projects:', error);
      throw new HttpException(
        'Error fetching user projects',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

  async getProjectsPeer(user: any, id: number, query?: string) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const project = await this.projectRepository.findOneBy({ id });
      if (!project)
        throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

      const queryBuilder = this.projectPeerRepository
        .createQueryBuilder('project_peer')
        .innerJoinAndSelect('project_peer.project', 'project')
        .innerJoinAndSelect('project_peer.user', 'user')
        .where('project_peer.project.id = :projectId', {
          projectId: project.id,
        })
        .select([
          'project_peer.id',
          'user.id',
          'user.first_name',
          'user.last_name',
          'user.email',
          'user.avatar',
        ]);

      if (query) {
        const lowerQuery = query.toLowerCase();
        queryBuilder.andWhere(
          `(LOWER(user.first_name) LIKE LOWER(:query) OR LOWER(user.last_name) LIKE LOWER(:query) OR LOWER(user.email) LIKE LOWER(:query))`,
          { query: `%${lowerQuery}%` },
        );
      }

      const project_peers = await queryBuilder.getMany();

      console.log(project_peers, 'project_peers');
      return {
        success: true,
        data: project_peers,
      };
    } catch (err) {
      throw new HttpException(
        err?.message || 'Failed to fetch project peers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserAccountById(userId: any) {
    const userFound = await this.usersService.getUserAccountById(userId);
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    delete userFound.password;
    delete userFound.logged_in;
    return userFound;
  }

  // async getProjectsPeer(user: any, projectId: number, query?: string) {
  //   try {
  //     const userFound = await this.usersService.getUserAccountById(user.userId);
  //     if (!userFound) {
  //       throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
  //     }

  //     const project = await this.projectRepository.findOneBy({ id: projectId });
  //     if (!project)
  //       throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

  //     const qb = this.projectPeerRepository
  //       .createQueryBuilder('project_peer')
  //       .innerJoinAndSelect('project_peer.project', 'project')
  //       .innerJoinAndSelect('project_peer.user', 'user')
  //       .where('project_peer.project.id = :projectId', {
  //         projectId: project.id,
  //       });

  //     // Optional filtering
  //     if (query && query.trim() !== '') {
  //       qb.andWhere(
  //         new Brackets((qb) => {
  //           qb.where('LOWER(user.first_name) LIKE :q', { q: `%${query.toLowerCase()}%` })
  //             .orWhere('LOWER(user.last_name) LIKE :q', { q: `%${query.toLowerCase()}%` })
  //             .orWhere('LOWER(user.email) LIKE :q', { q: `%${query.toLowerCase()}%` });
  //         })
  //       );
  //     }

  //     const project_peers = await qb
  //       .select([
  //         'project_peer.id',
  //         'user.id',
  //         'user.first_name',
  //         'user.last_name',
  //         'user.email',
  //         'user.avatar',
  //       ])
  //       .orderBy('user.first_name', 'ASC')
  //       .getMany();

  //     return {
  //       success: true,
  //       data: project_peers,
  //     };
  //   } catch (err) {
  //     throw new HttpException('Failed to fetch project peers', HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  // }

  async getProjectTasks(id: number, user: any): Promise<any> {
    console.log(id);
    const project = await this.projectRepository.findOneBy({ id });
    if (!project)
      throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

    const tasks = await this.taskRepository.find({
      where: {
        project: { id: project.id },
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

  async createProject(user: any, createProjectDetails: any) {
    try {
      // Validate user exists
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Parse category IDs
      const categoryIds = this.formatParseCategoryIds(
        createProjectDetails.category,
      );

      // Get categories from database
      const categories = await this.getCategoriesByIds(categoryIds);

      // Build project payload
      const payload = {
        title: createProjectDetails.title,
        description: createProjectDetails.description,
        due_date: moment.utc(createProjectDetails.deadline).toDate(),
        color: createProjectDetails.color,
        icon: createProjectDetails.icon,
        status: createProjectDetails.status,
        user: userFound,
        categories: categories ?? [],
      };

      // const savedProject = null;

      // console.log(createProjectDetails.peers, 'createProjectDetails.peers');
      // return;
      // Create and save the project
      const newProject = this.projectRepository.create(payload);
      const savedProject = await this.projectRepository.save(newProject);

      // Handle peer invitations if any peers were specified
      if (createProjectDetails.peers && createProjectDetails.peers.length > 0) {
        await this.sendProjectPeerInvite(
          userFound,
          createProjectDetails.peers,
          savedProject,
        );
        // return;
      }

      return {
        success: 'success',
        message: 'Project created successfully',
        data: savedProject,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      } else {
        console.error('Error creating project:', error);
        throw new HttpException(
          'Internal Server Error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  async getCategoriesByIds(categoryIds: string[]) {
    if (!categoryIds.length) return [];

    const categories = await this.categoryRepository.find({
      where: categoryIds.map((id) => ({ id: Number.parseInt(id) })),
    });

    if (categories.length !== categoryIds.length) {
      throw new HttpException(
        'Some categories not found',
        HttpStatus.BAD_REQUEST,
      );
    }

    return categories;
  }

  formatParseCategoryIds(category: string): string[] {
    if (!category) return [];

    try {
      return JSON.parse(category);
    } catch (err) {
      throw new HttpException(
        'Invalid categories format',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async sendProjectPeerInvite(
    user: any,
    emails: string,
    project: Project,
  ): Promise<any> {
    try {
      // Validate and clean email addresses
      const peerEmailsArray = JSON.parse(emails);
      // const peerEmailsArray =
      //   await this.usersService.validatePeerInviteEmails(emails);

      // Email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // Check for invalid emails
      const invalidEmails = peerEmailsArray.filter(
        (email: string) => !emailRegex.test(email),
      );

      if (invalidEmails.length > 0) {
        throw new HttpException(
          `Invalid email address(es) provided: ${invalidEmails.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      // console.log(peerEmailsArray, 'peerEmailsArray')
      // return

      // Process each peer email
      // console.log(peerEmailsArray)
      // return
      for (const email of peerEmailsArray) {
        // Skip if it's the current user's email
        if (user?.email === email) continue;

        // Find if the peer already exists as a user
        const foundPeer = await this.usersService.getUserAccountByEmail(email);
        const inviteCode = this.usersService.generateInviteCode();
        const inviteExpiry = addDays(new Date(), 7);

        // return
        // If peer exists as a user
        if (foundPeer) {
          // Check if user peer relationship already exists
          const existingPeer = await this.userPeerRepository.findOne({
            where: { user: { id: user?.id }, peer: { id: foundPeer?.id } },
          });

          // console.log(user, foundPeer, existingPeer, 'belbbkce');
          // return;

          // If no existing peer relationship, create user peer invite
          if (!existingPeer) {
            // Create user peer invite
            await this.userPeerInviteRepository.save({
              inviter_user_id: user,
              email,
              invite_code: inviteCode,
              invited_as: 'member',
              status: 'pending',
              due_date: inviteExpiry,
            });

            // Send user peer invite email
            await this.usersService.sendInviteMail(
              email,
              foundPeer,
              user,
              'member',
              inviteCode,
              foundPeer,
              project,
            );
            continue;
          }

          // console.log(existingPeer, 'existingPeerexistingPeer');
          // Check if project peer relationship already exists
          const existingProjectPeer = await this.projectPeerRepository.findOne({
            where: {
              user: { id: foundPeer?.id },
              addedBy: { id: user?.id },
              project: { id: project?.id }, // Important: Link to the specific project
            },
          });

          // If no existing project peer relationship, create project peer invite
          if (!existingProjectPeer) {
            // Create project peer invite
            await this.projectPeerInviteRepository.save({
              inviter_user_id: user,
              email,
              project: project, // Important: Link to the specific project
              invite_code: inviteCode,
              status: 'pending',
              due_date: inviteExpiry,
            });

            try {
              const payload = {
                recipient: foundPeer,
                sender: user,
                title: 'You received an invite',
                message: `${user?.fullName} sent you an invite to be a Peer on his Project ${project?.title}`,
                type: NOTIFICATION_TYPES.PROJECT_PEER_REQUEST,
              };

              // build payload
              await this.notificationService.createNotification(
                foundPeer,
                payload,
              );
              console.log(
                existingProjectPeer,
                payload,
                foundPeer,
                project,
                'feefef',
              );
            } catch (err) {
              console.log(err, 'err in notification');
            }

            // return;

            // Send project peer invite email
            await this.sendProjectPeerInviteMail(
              email,
              foundPeer,
              user,
              inviteCode,
              foundPeer,
              project, // Pass the project to the email function
            );
          }
        } else {
          // Handle invites for non-existing users
          // Create project peer invite for non-user
          await this.projectPeerInviteRepository.save({
            inviter_user_id: user,
            email,
            project: project, // Important: Link to the specific project
            invite_code: inviteCode,
            status: 'pending',
            due_date: inviteExpiry,
          });

          // Send project peer invite email to non-user
          await this.sendProjectPeerInviteMail(
            email,
            null, // No user found
            user,
            inviteCode,
            null,
            project, // Pass the project to the email function
          );
        }
      }

      return {
        success: true,
        message: 'Peer invites sent successfully',
      };
    } catch (err) {
      console.error('Error in sending peer invite:', err);
      throw new UnauthorizedException('Could not send peer invites');
    }
  }

  async sendProjectPeerInviteMail(
    email: string,
    foundPeer,
    user,
    inviteCode,
    existingPeer,
    project = null,
  ): Promise<any> {
    let peerEmail;
    let eventLink;
    let peerAccount = false;

    if (foundPeer || existingPeer) {
      eventLink = ` ${process.env.FRONTEND_URL}/auth/login?${inviteCode}`;
    } else {
      // eventLink = `${process.env.FRONTEND_URL}/auth/peer-invite?refCode=${inviteCode}&refEmail=${email}`;
    }

    // return;
    await this.MailingService.sendProjectPeerInvite(
      email,
      user,
      eventLink,
      foundPeer,
      peerEmail,
      project,
    );
  }

  async sendProjectComment(user: any, projectId: number, commentData: any) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // const project = await this.projectRepository.findOneBy({ id: projectId });
      const project = await this.projectRepository.findOne({
        where: { id: projectId },
        relations: ['user'], // <-- Load the owner relationship
      });
      if (!project)
        throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

      const { content, mentions } = commentData;

      const taggedUserIds = mentions;

      const message = this.projectCommentRepository.create({
        projectId,
        project,
        author: userFound,
        authorId: userFound.id,
        content,
        mentions: taggedUserIds,
        is_me: true,
      });
      await this.projectCommentRepository.save(message);

      delete message?.author?.password;
      delete message?.author?.logged_in;
      delete message?.project?.user?.password;
      delete message?.project?.user?.logged_in;

      this.projectGateway.server
        .to(`project_${projectId}`)
        .emit('new_comment', {
          projectId,
          comment: message,
        });

      // console.log(
      //   {
      //     projectId,
      //     comment: message,
      //   },
      //   'payload',
      // );

      // console.log(taggedUserIds, 'taggedUserIds');

      // Notify tagged users
      for (const userId of taggedUserIds) {
        if (userId === userFound.id) continue; // skip self

        const recipient = await this.usersService.getUserAccountById(userId);

        // build payload
        const notification = {
          title: 'You were mentioned',
          message: `You were mentioned the project ${(project?.title).toUpperCase()}'s comment`,
          sender: userFound,
          recipient,
          type: NOTIFICATION_TYPES.PROJECT_COMMENT,
        };

        const savedNotification =
          await this.notificationService.createNotification(
            userFound,
            notification,
          );

        this.projectGateway.server
          .to(`user_${userId}`)
          .emit('mention_notification', {
            notification: savedNotification,
            comment: message,
          });
      }

      await this.sendNewCommentPeerNotification(userFound, project);

      return {
        success: true,
        comment: message,
      };
    } catch (err) {}
  }

  async sendNewCommentPeerNotification(userFound: User, project: Project) {
    try {
      // console.log(project, project?.user, 'here')
      const projectOwnerId = project?.user?.id;

      const projectPeers = await this.projectPeerRepository
        .createQueryBuilder('project_peer')
        .innerJoinAndSelect('project_peer.project', 'project')
        .innerJoinAndSelect('project_peer.user', 'user')
        .where('project_peer.project.id = :projectId', {
          projectId: project.id,
        })
        .getMany();

      const notifiedUserIds = new Set<number>();

      for (const peer of projectPeers) {
        const peerUserId = peer.user.id;
        if (peerUserId === userFound.id) continue;

        const recipient =
          await this.usersService.getUserAccountById(peerUserId);

        // build payload
        const notification = {
          title: 'New Comment',
          message: `${userFound?.fullName} commented on project ${(project?.title).toUpperCase()}`,
          sender: userFound,
          recipient,
          type: NOTIFICATION_TYPES.PROJECT_COMMENT,
        };

        // console.log('ewneej')
        await this.notificationService.createNotification(
          userFound,
          notification,
        );
        // console.log('222')

        notifiedUserIds.add(peerUserId);
      }

      // console.log(project.user &&
      //   projectOwnerId !== userFound.id &&
      //   !notifiedUserIds.has(projectOwnerId), 'wwewewe')
      // Now notify project owner (if not the commenter + not already notified)
      if (
        project.user &&
        projectOwnerId !== userFound.id &&
        !notifiedUserIds.has(projectOwnerId)
      ) {
        const owner =
          await this.usersService.getUserAccountById(projectOwnerId);

        const ownerNotification = {
          title: 'New Comment',
          message: `${
            userFound.fullName
          } commented on project ${project.title.toUpperCase()}`,
          sender: userFound,
          recipient: owner,
          type: NOTIFICATION_TYPES.PROJECT_COMMENT,
        };

        await this.notificationService.createNotification(
          userFound,
          ownerNotification,
        );
      }
    } catch (err) {
      console.log(err, 'errrr');
    }
  }

  async getProjectComments(user: any, projectId: number) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const project = await this.projectRepository.findOneBy({ id: projectId });
      if (!project)
        throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);

      const comments = await this.projectCommentRepository.find({
        where: { projectId },
        relations: ['author'],
        order: { created_at: 'ASC' },
      });

      console.log(comments, 'commentsss');

      return {
        success: true,
        comments: comments.map((comment) => ({
          ...comment,
          is_me: comment.authorId == userFound.id,
        })),
      };
    } catch (err) {}
  }

  async addReaction(user: any, messageId: string, emoji: string) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }
      const userId = userFound?.id;
      const message = await this.projectCommentRepository.findOne({
        where: { id: messageId },
      });
      if (!message) return;

      const reactions = message.reactions || [];
      reactions.push({ userId, emoji });
      message.reactions = reactions;
      await this.projectCommentRepository.save(message);
    } catch (err) {}
  }

  async markMessagesSeen(user: any, messageIds: string[]) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Find all the messages
      const messages = await this.projectCommentRepository.findBy({
        id: In(messageIds),
      });

      // Update each message's seen status
      // This implementation depends on your database structure
      // Assuming each message has a seenBy array of user IDs
      for (const message of messages) {
        // Initialize seenBy if it doesn't exist
        if (!message.seenBy) {
          message.seenBy = [];
        }

        // Add user to seenBy if not already there
        if (!message.seenBy.includes(String(userFound.id))) {
          message.seenBy.push(String(userFound.id));
        }
      }

      // Save all updated messages
      await this.projectCommentRepository.save(messages);

      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  public async getProjectsForUser({ userId }): Promise<string[]> {
    try {
      const queryBuilder = this.projectRepository
        .createQueryBuilder('project')
        .select('project.id', 'id')
        .leftJoin('project.user', 'owner')
        .where(
          new Brackets((qb) => {
            qb.where('owner.id = :userId', { userId }).orWhere((subQb) => {
              const subQuery = subQb
                .subQuery()
                .select('pp.project_id')
                .from('project_peers', 'pp')
                .where('pp.user_id = :userId', { userId })
                .getQuery();
              return 'project.id IN ' + subQuery;
            });
          }),
        );

      const projects = await queryBuilder.getRawMany();

      return projects.map((p) => p.id);
    } catch (error) {
      return [];
    }
  }

  async findProjectPeersInvite(
    user: any,
    page = 1,
    limit = 10,
    search?: string,
    status?: string,
    type: string = 'to_me',
  ): Promise<any> {
    try {
      const foundUser = await this.usersService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      console.log('wwewe');

      const queryBuilder = this.projectPeerInviteRepository
        .createQueryBuilder('project_peer_invites')
        .leftJoin('project_peer_invites.inviter_user_id', 'inviter')
        .leftJoin('project_peer_invites.project', 'project')
        .addSelect([
          'inviter.id',
          'inviter.first_name',
          'inviter.last_name',
          'inviter.email',
          'project.id',
          'project.title',
          'project.description',
        ]);

      switch (type) {
        case 'by_me':
          queryBuilder.where('project_peer_invites.inviter_user_id = :id', {
            id: foundUser.id,
          });
          break;
        case 'to_me':
        default:
          queryBuilder.where('project_peer_invites.email = :email', {
            email: foundUser.email,
          });
          break;
      }

      queryBuilder.orderBy('project_peer_invites.created_at', 'DESC'); // <-- new line
      queryBuilder.addOrderBy('project_peer_invites.id', 'DESC'); // fallback order

      if (search) {
        const lowered = `%${search.toLowerCase()}%`;
        queryBuilder.andWhere(
          `(LOWER(project.title) LIKE :search OR LOWER(project.description) LIKE :search OR LOWER(inviter.first_name) LIKE :search OR LOWER(inviter.last_name) LIKE :search OR LOWER(inviter.email) LIKE :search)`,
          { search: lowered },
        );
      }

      // Handle status
      if (status && status !== 'all') {
        const loweredStatus = status.toLowerCase();
        queryBuilder.andWhere(
          `LOWER(project_peer_invites.status) = :status`, // assuming you have a `status` column
          { status: loweredStatus },
        );
      }

      queryBuilder.skip((page - 1) * limit).take(limit);

      const [result, total] = await queryBuilder.getManyAndCount();
      const lastPage = Math.ceil(total / limit);

      const pendingInvites =
        await this.countProjectPendingPeerInvites(foundUser);
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
        pending_invites: pendingInvites,
        success: true,
      };
    } catch (error) {
      console.error('Error fetching project peers:', error);
      throw new HttpException(
        'An Error Occurred While Fetching Project Peers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async countPendingPeerInvites(user: any): Promise<any> {
    const foundUser = await this.usersService.getUserAccountById(user.userId);
    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    const receivedPending =
      await this.countProjectPendingPeerInvites(foundUser);
    const sentPending =
      await this.countSentProjectPendingPeerInvites(foundUser);

    return {
      data: { receivedPending, sentPending },
      success: true,
    };
  }

  async countProjectPendingPeerInvites(user) {
    return await this.projectPeerInviteRepository.count({
      where: {
        email: user?.email,
        status: 'pending',
      },
    });
  }

  async countSentProjectPendingPeerInvites(user) {
    return await this.projectPeerInviteRepository.count({
      where: {
        inviter_user_id: user,
        status: 'pending',
      },
    });
  }

  async acceptPeerInvite(user: any, id) {
    try {
      const foundUser = await this.usersService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      let message;
      const invite = await this.projectPeerInviteRepository.findOne({
        where: { id: id },
        relations: ['project'],
      });

      const response = await this.getPeerInviteCodeStatus(
        invite?.invite_code,
        true,
      );

      // console.log(invite, response, response.success, 'invitee');
      // return;

      if (response.success) {
        invite.status = 'accepted';
        await this.projectPeerInviteRepository.save(invite);

        const createSuccess = await this.createProjectPeer(
          invite?.invite_code,
          foundUser,
          invite?.project,
        );

        // return
        console.log(createSuccess, invite, response, 'invitee');

        if (createSuccess?.success) {
          message = 'Invite has been Accepted';
          return {
            success: true,
            invite_status: invite.status,
            message: message,
          };
        }
      }
      // return

      return {
        success: false,
        message: response?.message,
      };
    } catch (err) {
      console.log(err, 'error');
    }
  }

  async rejectPeerInvite(user: any, id) {
    try {
      const foundUser = await this.usersService.getUserAccountById(user.userId);
      if (!foundUser) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      let message;
      const invite = await this.projectPeerInviteRepository.findOne({
        where: { id: id },
        relations: ['project'],
      });

      const response = await this.getPeerInviteCodeStatus(
        invite?.invite_code,
        true,
      );

      console.log(invite, response, response.success, 'invitee');
      // return;

      if (response?.success) {
        invite.status = 'declined';
        await this.projectPeerInviteRepository.save(invite);

        const createSuccess = await this.rejectUserPeer(
          invite?.invite_code,
          foundUser,
          invite?.project,
        );

        console.log(createSuccess, invite, response, 'invitee');

        if (createSuccess?.success) {
          message = 'Invite has been Rejected';
          return {
            success: true,
            invite_status: invite.status,
            message: message,
          };
        }
      }

      return {
        success: false,
        message: response?.message,
      };
    } catch (err) {}
  }

  async getPeerInviteCodeStatus(
    inviteCode: string,
    markExpire = true,
  ): Promise<{
    success: boolean;
    status: string;
    isActive: boolean;
    message: string;
  }> {
    const invite = await this.projectPeerInviteRepository.findOne({
      where: { invite_code: inviteCode },
    });

    if (!invite) {
      return {
        success: false,
        status: 'invalid',
        isActive: false,
        message: 'Invite not found.',
      };
    }

    if (markExpire) {
      // Adjust now by +1 hour to account for timezone difference
      const now = addHours(new Date(), 1);
      const isExpired = invite.due_date ? invite.due_date <= now : true;

      // Auto-mark as expired if due date passed and status is still pending
      if (isExpired && invite.status === 'pending') {
        invite.status = 'expired';
        await this.projectPeerInviteRepository.save(invite);
      }
    }

    if (invite.status === 'expired') {
      return {
        success: false,
        status: 'expired',
        isActive: false,
        message: 'Invite has expired.',
      };
    }

    if (invite.status !== 'pending') {
      return {
        success: false,
        status: invite.status,
        isActive: false,
        message: 'Invite is no longer valid.',
      };
    }

    // If still pending and valid
    return {
      success: true,
      status: 'pending',
      isActive: true,
      message: 'Invite is valid and pending.',
    };
  }

  async createProjectPeer(inviteCode: string, newUser: User, project: Project) {
    try {
      const invite = await this.projectPeerInviteRepository.findOne({
        where: { invite_code: inviteCode },
        relations: ['inviter_user_id'],
      });

      console.log(invite, 'invite in create user peer');
      if (!invite) {
        // Invalid invite code — silently skip peer creation (optional: log if needed)
        return null;
      }

      const invitedBy = await this.getUserAccountById(
        invite.inviter_user_id.id,
      );

      console.log(invite.status, 'invite.status');
      if (invite.status !== 'accepted') {
        // Invite not accepted — skip peer creation
        return null;
      }

      // const existingConnection = await this.projectPeerRepository
      //   .createQueryBuilder('project_peer')
      //   .leftJoin('project_peer.project', 'project') // join the project relation
      //   .where(
      //     'project.id = :projectId AND ((project_peer.user_id = :user1 AND project_peer.added_by = :user2) OR (project_peer.user_id = :user2 AND project_peer.added_by = :user1))',
      //     {
      //       projectId: project.id,
      //       user1: invitedBy.id,
      //       user2: newUser.id,
      //     },
      //   )
      //   .getOne();

      const existingConnection = await this.projectPeerRepository
        .createQueryBuilder('project_peer')
        .leftJoin('project_peer.project', 'project') // join the project relation
        .where(
          'project.id = :projectId AND ((project_peer.user_id = :user1 AND project_peer.added_by = :user2) OR (project_peer.user_id = :user2 AND project_peer.added_by = :user1))',
          {
            projectId: project.id,
            user1: invitedBy.id,
            user2: newUser.id,
          },
        )
        .getOne();

      console.log(existingConnection, 'existingConnection');
      // return

      if (existingConnection) {
        console.log(
          `Users ${invitedBy.id} and ${newUser.id} are already connected to the project. Skipping peer creation.`,
        );
        return null;
      }

      // console.log(existingConnection, 'existingConnection');
      if (existingConnection) {
        // Already connected — skip peer creation silently
        return null;
      }

      const peerToUser = this.projectPeerRepository.create({
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
        project: project,
        addedBy: { id: invitedBy.id },
        user: { id: newUser.id },
      });

      await this.projectPeerRepository.save(peerToUser);

      const payload = {
        recipient: newUser,
        sender: invitedBy,
        title: 'Project Peer Invite Acceptance',
        message: `You accepted the invitation to be a Peer on the project: ${project?.title}`,
        type: 'project_peer_request',
      };
      // build payload
      await this.notificationService.createNotification(newUser, payload);

      const payload2 = {
        recipient: invitedBy,
        sender: newUser,
        title: 'Project Peer Invite Acceptance',
        message: `${newUser?.fullName} has accepted your invitation to be a Project Peer on ${project?.title}`,
        type: 'project_peer_request',
      };
      // build payload
      await this.notificationService.createNotification(invitedBy, payload2);

      return {
        success: true,
      };
    } catch (err) {
      return {
        success: false,
      };
    }
  }

  async rejectUserPeer(inviteCode: string, newUser: User, project) {
    try {
      const invite = await this.projectPeerInviteRepository.findOne({
        where: { invite_code: inviteCode },
        relations: ['inviter_user_id'], // Use the actual relation property name
      });

      if (!invite) {
        return null;
      }

      const invitedBy = await this.getUserAccountById(
        invite.inviter_user_id.id,
      );

      if (invite.status !== 'declined') {
        return null;
      }

      const existingConnection = await this.projectPeerRepository
        .createQueryBuilder('project_peer')
        .leftJoin('project_peer.project', 'project') // join the project relation
        .where(
          'project.id = :projectId AND ((project_peer.user_id = :user1 AND project_peer.added_by = :user2) OR (project_peer.user_id = :user2 AND project_peer.added_by = :user1))',
          {
            projectId: project.id,
            user1: invitedBy.id,
            user2: newUser.id,
          },
        )
        .getOne();

      console.log(
        `Users ${invitedBy.id} and ${newUser.id} are already connected. Skipping peer creation.`,
      );

      await this.notifyReceiver(invitedBy, newUser, project);

      await this.notifyInviter(invitedBy, newUser, project);

      return { success: true };
    } catch (err) {
      console.error('Error rejecting peer invite:', err);
      return { success: false, message: 'Failed to reject peer invite.' };
    }
  }

  async notifyInviter(invitedBy, newUser, project) {
    const payloadForInviter = {
      recipient: invitedBy,
      sender: newUser,
      title: 'Project Peer Invite Rejection',
      message: `${newUser?.email} has rejected your invitation to be a Project Peer to ${project?.title}`,
      type: 'project_peer_request',
    };

    await this.notificationService.createNotification(
      invitedBy,
      payloadForInviter,
    );
  }

  async notifyReceiver(invitedBy, newUser, project) {
    const payloadForRejecter = {
      recipient: newUser,
      sender: invitedBy,
      title: 'Project Peer Invite Rejection',
      message: `You rejected an invite to be a Peer in ${project?.title}`,
      type: 'project_peer_request',
    };

    await this.notificationService.createNotification(
      newUser,
      payloadForRejecter,
    );
  }

  async checkSessionTimezone(user: any) {
    const result = await this.entityManager.query('SELECT @@session.time_zone');
    console.log('Current session timezone:', result[0]['@@session.time_zone']);
  }

  // todo: outdated, remove
  async findUserProjects2(
    user: any,
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: string,
    due_date?: string,
    group: string = 'all',
  ): Promise<any> {
    try {
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
        .leftJoinAndSelect('project.tags', 'tags') // Include tags relationship
        .leftJoinAndSelect('project.categories', 'categories') // Include categories relationship
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
            new Brackets((qb) => {
              qb.where('owner.id = :userId', { userId: userFound.id }).orWhere(
                'projectPeers.user.id = :userId',
                { userId: userFound.id },
              );
            }),
          );
          break;
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
    } catch (error) {
      console.error('Error fetching user projects:', error);
      throw new HttpException(
        'Error fetching user projects',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

        const inviteCode = this.usersService.generateInviteCode(); // Assuming you have this function

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

  async projectOverviewData(projectId: number, user: any) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // Get project with peers using QueryBuilder
      const project = await this.projectRepository
        .createQueryBuilder('project')
        .leftJoinAndSelect('project.projectPeers', 'projectPeers')
        .leftJoinAndSelect('projectPeers.user', 'user')
        .select([
          'project.id',
          'project.title',
          'project.description',
          'projectPeers.id',
          'user.id',
          'user.first_name',
          'user.last_name',
          'user.avatar',
          'user.email',
        ])
        .where('project.id = :projectId', { projectId })
        .getOne();

      if (!project) {
        throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);
      }

      // Get statuses using QueryBuilder
      const statuses = await this.statusRepository
        .createQueryBuilder('status')
        .select(['status.id', 'status.title', 'status.color'])
        .where('status.user.id = :userId', { userId: userFound.id })
        .getMany();

      // Get tasks with counts grouped by status (optimized single query)
      const taskCounts = await this.taskRepository
        .createQueryBuilder('task')
        .select('task.status.id', 'statusId')
        .addSelect('COUNT(task.id)', 'count')
        .where('task.project.id = :projectId', { projectId })
        .groupBy('task.status.id')
        .getRawMany();

      // Get tasks with assignees
      const tasks = await this.taskRepository
        .createQueryBuilder('task')
        .leftJoinAndSelect('task.status', 'status')
        .leftJoinAndSelect('task.assignees', 'assignees') // Changed from leftJoin to leftJoinAndSelect
        .select([
          'task.id',
          'task.title',
          'task.description',
          'task.due_date', // This will now work
          'task.priority', // This will now work
          'status.id',
          'status.title',
          'status.color',
          'assignees.id',
          'assignees.first_name',
          'assignees.last_name',
          'assignees.avatar',
          'assignees.email',
        ])
        .where('task.project.id = :projectId', { projectId })
        .getMany();

      const statusCounts: Record<number, number> = {};
      statuses.forEach((status) => {
        statusCounts[status.id] = 0;
      });

      taskCounts.forEach((row) => {
        if (row.statusId && statusCounts.hasOwnProperty(row.statusId)) {
          statusCounts[row.statusId] = parseInt(row.count);
        }
      });

      const statusArray = statuses.map(
        (status) => statusCounts[status.id] || 0,
      );

      return {
        projectPeers: project.projectPeers.map((peer) => ({
          id: peer.user.id,
          first_name: peer.user.first_name,
          last_name: peer.user.last_name,
          avatar: peer.user.avatar,
          email: peer.user.email,
        })),
        tasks: tasks,
        totalTasks: tasks.length,
        statusBreakdown: statusArray,
        statuses: statuses.map((s) => ({
          id: s.id,
          title: s.title,
          color: s.color,
        })),
      };
    } catch (err) {
      console.error('Error in ProjectOverviewData:', err);
      throw new HttpException(
        'Failed to get project overview',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async projectOverviewData2(projectId: number, user: any) {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const project = await this.projectRepository.findOne({
        where: { id: projectId },
        relations: ['projectPeers', 'projectPeers.user'],
      });
      if (!project) {
        throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);
      }

      const statuses = await this.statusRepository.find({
        where: { user: { id: userFound.id } },
      });

      const tasks = await this.taskRepository.find({
        where: { project: { id: project.id } },
        relations: ['status', 'assignees'],
      });

      const statusCounts: Record<string, number> = {};
      statuses.forEach((status) => {
        statusCounts[status.id] = 0;
      });

      tasks.forEach((task) => {
        const statusId = task.status?.id;
        if (statusId && statusCounts.hasOwnProperty(statusId)) {
          statusCounts[statusId]++;
        }
      });

      const statusArray = statuses.map((status) => statusCounts[status.id]);

      return {
        projectPeers: project.projectPeers.map((peer) => ({
          id: peer.user.id,
          first_name: peer.user.first_name,
          last_name: peer.user.last_name,
          avatar: peer.user.avatar,
          email: peer.user.email,
        })),
        tasks: tasks.map((task) => ({
          ...task,
          assignees: task.assignees?.map((a) => ({
            id: a.id,
            first_name: a.first_name,
            last_name: a.last_name,
            avatar: a.avatar,
            email: a.email,
          })),
        })),
        totalTasks: tasks.length,
        statusBreakdown: statusArray,
        statuses: statuses.map((s) => ({
          id: s.id,
          title: s.title,
          color: s.color,
        })),
      };
    } catch (err) {
      console.error('Error in ProjectOverviewData:', err);
      throw new HttpException(
        'Failed to get project overview',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
