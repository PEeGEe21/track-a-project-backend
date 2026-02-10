import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateWhiteboardDto } from '../dto/create-whiteboard.dto';
import { UpdateWhiteboardDto } from '../dto/update-whiteboard.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Whiteboard } from 'src/typeorm/entities/Whiteboard';
import { Brackets, Repository } from 'typeorm';
import { Project } from 'src/typeorm/entities/Project';
import { UsersService } from 'src/users/services/users.service';
// import {uuidv4}
import { v4 as uuidv4 } from 'uuid';
import { WhiteboardState } from 'src/utils/types';
import { TenantQueryHelper } from 'src/common/helpers/tenant-query.helper';

@Injectable()
export class WhiteboardsService {
  private readonly logger = new Logger(WhiteboardsService.name);
  private saveDebounceTimers = new Map<string | number, NodeJS.Timeout>();
  private pendingStates = new Map<
    string | number,
    { state: WhiteboardState; userId: string }
  >();

  constructor(
    private usersService: UsersService,

    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(Whiteboard)
    private whiteboardRepository: Repository<Whiteboard>,
  ) {}

  async getWhiteboardState(
    organizationId: string,
    projectId?: number | null,
    whiteboardId?: string,
  ): Promise<WhiteboardState> {
    try {
      let whiteboard = null;

      // Try project-based lookup first (only if valid projectId)
      // if (projectId && !isNaN(projectId)) {
      //   this.logger.debug(`Looking up whiteboard for project ID: ${projectId}`);
      //   whiteboard = await this.whiteboardRepository.findOne({
      //     where: { project: { id: projectId } },
      //   });
      // }

      // // If not found and a whiteboardId was provided, try by whiteboardId
      // if (!whiteboard && whiteboardId) {
      //   this.logger.debug(
      //     `Looking up whiteboard for whiteboardId: ${whiteboardId}`,
      //   );
      //   whiteboard = await this.whiteboardRepository.findOne({
      //     where: { whiteboardId },
      //   });
      // }

      // Build query with organization filter
      const qb = TenantQueryHelper.createOrganizationQuery(
        this.whiteboardRepository,
        organizationId,
        'whiteboard',
      );

      if (projectId && !isNaN(projectId)) {
        qb.andWhere('whiteboard.project_id = :projectId', { projectId });
        whiteboard = await qb.getOne();
      } else if (whiteboardId) {
        qb.andWhere('whiteboard.whiteboardId = :whiteboardId', {
          whiteboardId,
        });
        whiteboard = await qb.getOne();
      }

      // Return default empty whiteboard state if not found
      if (!whiteboard) {
        return {
          title: 'Whiteboard', // Default title
          whiteboardId: whiteboardId ?? undefined,
          elements: [],
          appState: {},
          files: {},
        };
      }

      // Return found whiteboard state
      return {
        whiteboardId: whiteboard.whiteboardId,
        elements: whiteboard.elements || [],
        appState: whiteboard.appState || {},
        files: whiteboard.files || {},
        title: whiteboard.title || 'Whiteboard', // Include title
      };
    } catch (error) {
      this.logger.error(
        `Error getting whiteboard state for project ${projectId} or whiteboardId ${whiteboardId}:`,
        error,
      );
      return { elements: [], appState: {}, files: {}, title: 'Whiteboard' };
    }
  }

  // src/whiteboards/services/whiteboards.service.ts
  async updateWhiteboardTitle(
    whiteboardId: string,
    title: string,
    userId: string,
  ): Promise<void> {
    try {
      const userFound = await this.usersService.getUserAccountById(
        Number(userId),
      );
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const whiteboard = await this.whiteboardRepository.findOne({
        where: { whiteboardId },
        relations: ['lastModifiedBy', 'user'],
      });

      if (!whiteboard) {
        throw new HttpException('Whiteboard not found', HttpStatus.NOT_FOUND);
      }

      whiteboard.title = title || 'Whiteboard';
      whiteboard.lastModifiedBy = userFound;
      whiteboard.updated_at = new Date();

      await this.whiteboardRepository.save(whiteboard);
      this.logger.log(
        `Title updated for whiteboard ${whiteboardId} to "${title}"`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating title for whiteboard ${whiteboardId}:`,
        error,
      );
      throw new HttpException(
        `Failed to update title: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async create(uploadFileDto, user: any, organizationId: string): Promise<any> {
    try {
      const { projectId, elements, appState, files, whiteboardId } =
        uploadFileDto;

      if (projectId) {
        const project = await this.projectRepository.findOne({
          where: { id: projectId, organization_id: organizationId },
        });

        if (!project) {
          throw new HttpException(
            'Project not found in this organization',
            HttpStatus.NOT_FOUND,
          );
        }
      }

      const state = {
        elements,
        appState,
        files,
      };

      await this.performSave(
        organizationId,
        projectId,
        state,
        user?.userId,
        whiteboardId,
      );

      return {
        success: true,
        message: 'Whiteboard Saved Successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to save: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async saveWhiteboardState(
    organizationId: string,
    projectId: number | null,
    state: WhiteboardState,
    userId: string,
    whiteboardId?: string | null,
    title?: string | null,
  ): Promise<void> {
    // ✅ Skip project lookup if projectId is null
    if (projectId) {
      const project = await this.projectRepository.findOneBy({ id: projectId });
      if (!project)
        throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);
    }

    // Use '0' or userId as fallback key in your map (so NaN never appears)
    const key = projectId ?? `user-${userId}`;
    this.pendingStates.set(key, { state, userId });

    if (this.saveDebounceTimers.has(key)) {
      clearTimeout(this.saveDebounceTimers.get(key));
    }

    const timer = setTimeout(async () => {
      const pending = this.pendingStates.get(key);
      if (pending) {
        await this.performSave(
          organizationId,
          projectId,
          pending.state,
          pending.userId,
          whiteboardId,
          title,
        );
        this.pendingStates.delete(key);
        this.saveDebounceTimers.delete(key);
      }
    }, 2000);

    this.saveDebounceTimers.set(key, timer);
  }

  private async performSave(
    organizationId: string,
    projectId: number | null,
    state: WhiteboardState,
    userId: string,
    whiteboardId?: string,
    title?: string,
  ): Promise<void> {
    try {
      const userFound = await this.usersService.getUserAccountById(
        Number(userId),
      );
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      let existingWhiteboard: Whiteboard | null = null;

      // Try to find by whiteboardId first (if provided)
      if (whiteboardId) {
        existingWhiteboard = await this.whiteboardRepository.findOne({
          where: { whiteboardId },
          relations: ['project', 'lastModifiedBy', 'user'],
        });
      }

      // If not found by whiteboardId and projectId is provided, try finding by projectId
      if (!existingWhiteboard && projectId) {
        existingWhiteboard = await this.whiteboardRepository.findOne({
          where: { project: { id: projectId } },
          relations: ['project', 'lastModifiedBy', 'user'],
        });
      }

      // If still not found and it's a standalone whiteboard, try finding by userId
      if (!existingWhiteboard && !projectId && whiteboardId) {
        existingWhiteboard = await this.whiteboardRepository.findOne({
          where: { whiteboardId, project: null, user: { id: userFound.id } },
          relations: ['project', 'lastModifiedBy', 'user'],
        });
      }

      if (existingWhiteboard) {
        // Update existing whiteboard
        existingWhiteboard.elements = state.elements;
        existingWhiteboard.appState = state.appState;
        existingWhiteboard.files = state.files;
        existingWhiteboard.lastModifiedBy = userFound;
        existingWhiteboard.updated_at = new Date();
        existingWhiteboard.title = title || 'Whiteboard';

        await this.whiteboardRepository.save(existingWhiteboard);
        this.logger.log(
          `Whiteboard updated for ${
            projectId ? 'project ' + projectId : 'standalone board'
          }, whiteboardId: ${existingWhiteboard.whiteboardId}`,
        );
      } else {
        // Create new whiteboard
        const newWhiteboard = this.whiteboardRepository.create({
          whiteboardId: whiteboardId || uuidv4(), // Use provided whiteboardId or generate new
          project: projectId ? { id: projectId } : null,
          elements: state.elements,
          appState: state.appState,
          files: state.files,
          lastModifiedBy: userFound,
          user: userFound,
          title: title || 'Whiteboard',
          organization_id: organizationId,
        });
        await this.whiteboardRepository.save(newWhiteboard);
        this.logger.log(
          `Whiteboard created for ${
            projectId ? 'project ' + projectId : 'standalone board'
          }, whiteboardId: ${newWhiteboard.whiteboardId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error saving whiteboard for ${projectId ?? 'standalone'}:`,
        error,
      );
      throw new HttpException(
        `Failed to save whiteboard: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async performSave2(
    projectId: number | null,
    state: WhiteboardState,
    userId: string,
    whiteboardId?: string,
  ): Promise<void> {
    try {
      const userFound = await this.usersService.getUserAccountById(
        Number(userId),
      );
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      let existingWhiteboard;

      if (projectId) {
        existingWhiteboard = await this.whiteboardRepository.findOne({
          where: { project: { id: projectId } },
        });
      } else {
        // 🧠 Handle standalone board (e.g., by user)
        // existingWhiteboard = await this.whiteboardRepository.findOne({
        //   where: { project: null, lastModifiedBy: { id: userFound.id } },
        // });
        existingWhiteboard = await this.whiteboardRepository.findOne({
          where: { whiteboardId }, // assuming you have a `uuid` column
        });
      }

      if (existingWhiteboard) {
        existingWhiteboard.elements = state.elements;
        existingWhiteboard.appState = state.appState;
        existingWhiteboard.files = state.files;
        existingWhiteboard.lastModifiedBy = userFound;
        existingWhiteboard.updated_at = new Date();
        await this.whiteboardRepository.save(existingWhiteboard);
      } else {
        const newWhiteboard = this.whiteboardRepository.create({
          whiteboardId,
          project: projectId ? { id: projectId } : null,
          elements: state.elements,
          appState: state.appState,
          files: state.files,
          lastModifiedBy: userFound,
          user: userFound,
        });
        await this.whiteboardRepository.save(newWhiteboard);
      }

      this.logger.log(
        `Whiteboard saved for ${
          projectId ? 'project ' + projectId : 'standalone board'
        }`,
      );
    } catch (error) {
      this.logger.error(
        `Error saving whiteboard for ${projectId ?? 'standalone'}:`,
        error,
      );
    }
  }

  async deleteWhiteboard(
    boardId: string,
    organizationId: string,
  ): Promise<any> {
    try {
      const board = await this.whiteboardRepository.findOne({
        where: { id: boardId, organization_id: organizationId },
      });

      if (!board) {
        throw new HttpException(
          'Whiteboard not found in this organization',
          HttpStatus.NOT_FOUND,
        );
      }

      const resp = await this.whiteboardRepository.delete(board.id);

      this.logger.log(`Whiteboard deleted ${boardId}`);

      return {
        success: true,
        message: 'Whiteboard deleted successfully',
        result: resp,
      };
    } catch (error) {
      this.logger.error(`Error deleting whiteboard ${boardId}:`, error);

      return {
        success: false,
        message: error?.message ?? 'Error deleting whiteboard',
      };
    }
  }

  async saveThumbnail(
    whiteboardId: string,
    thumbnail: string,
    projectId?: number,
  ): Promise<void> {
    try {
      let whiteboard;

      if (projectId) {
        whiteboard = await this.whiteboardRepository.findOne({
          where: { project: { id: projectId } },
        });
      } else {
        whiteboard = await this.whiteboardRepository.findOne({
          where: { whiteboardId },
        });
      }

      if (whiteboard) {
        whiteboard.thumbnail = thumbnail; // Make sure you have a 'thumbnail' column (LONGTEXT)
        whiteboard.updated_at = new Date();
        await this.whiteboardRepository.save(whiteboard);
        this.logger.log(`Thumbnail saved for whiteboard ${whiteboardId}`);
      }
    } catch (error) {
      this.logger.error(`Error saving thumbnail for ${whiteboardId}:`, error);
    }
  }

  /**
   * Get all user whiteboards with tenant isolation
   */
  async getAllUserWhiteboards(
    user: any,
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
    projectId?: string,
    orderBy: any = 'DESC',
    sortBy: any = 'updated_at',
    group: string = 'all',
  ): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(
        user.userId,
      );
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const qb = TenantQueryHelper.createOrganizationQuery(
        this.whiteboardRepository,
        organizationId,
        'whiteboard',
      );

      // Select fields
      qb.select([
        'whiteboard.id',
        'whiteboard.whiteboardId',
        'whiteboard.title',
        'whiteboard.description',
        'whiteboard.created_at',
        'whiteboard.updated_at',
        'whiteboard.thumbnail',
      ]);

      // Join project and verify it's in same organization
      qb.leftJoin(
        'whiteboard.project',
        'project',
        'project.organization_id = :organizationId',
        { organizationId },
      )
        .addSelect([
          'project.id',
          'project.title',
          'project.description',
          'project.color',
          'project.icon',
        ])
        .leftJoin('project.user', 'owner')
        .addSelect([
          'owner.id',
          'owner.first_name',
          'owner.last_name',
          'owner.email',
          'owner.avatar',
        ]);

      // Join project peers (also scoped to organization)
      qb.leftJoin(
        'project.projectPeers',
        'projectPeers',
        'projectPeers.organization_id = :organizationId',
      )
        .leftJoin('projectPeers.user', 'peerUsers')
        .addSelect([
          'peerUsers.id',
          'peerUsers.first_name',
          'peerUsers.last_name',
          'peerUsers.email',
          'peerUsers.avatar',
        ]);

      // Tags and categories
      qb.leftJoinAndSelect('project.tags', 'tags').leftJoinAndSelect(
        'project.categories',
        'categories',
      );

      // Last modified by
      qb.leftJoin('whiteboard.lastModifiedBy', 'lastModifiedBy').addSelect([
        'lastModifiedBy.id',
        'lastModifiedBy.first_name',
        'lastModifiedBy.last_name',
        'lastModifiedBy.email',
        'lastModifiedBy.avatar',
      ]);

      // Filter by specific project (already org-scoped)
      if (projectId) {
        qb.andWhere('project.id = :projectId', {
          projectId: Number(projectId),
        });
      }

      // Apply group filters (all within organization)
      switch (group) {
        case 'my':
          qb.andWhere('whiteboard.user_id = :userId', {
            userId: userFound.id,
          });
          break;

        case 'peer':
          qb.andWhere((qb) => {
            const subQuery = qb
              .subQuery()
              .select('pp.project_id')
              .from('project_peers', 'pp')
              .where('pp.user_id = :userId', { userId: userFound.id })
              .andWhere('pp.organization_id = :organizationId', {
                organizationId,
              })
              .getQuery();
            return 'project.id IN ' + subQuery;
          });
          break;

        case 'all':
        default:
          // User's own whiteboards OR whiteboards in projects they have access to
          TenantQueryHelper.addUserAccessFilter(
            qb,
            userFound.id,
            organizationId,
            {
              entityAlias: 'whiteboard',
              userIdColumn: 'user_id',
              includeOrganizationFilter: false, // Already filtered above
            },
          );
          break;
      }

      // Search
      if (search) {
        const lowered = `%${search.toLowerCase()}%`;
        qb.andWhere(
          `(LOWER(whiteboard.title) LIKE :search OR LOWER(project.title) LIKE :search OR LOWER(project.description) LIKE :search)`,
          { search: lowered },
        );
      }

      // Sorting
      const sortFieldMap = {
        updated_at: 'whiteboard.updated_at',
        created_at: 'whiteboard.created_at',
        alphabetical: 'whiteboard.title',
      };

      qb.orderBy(
        sortFieldMap[sortBy] || 'whiteboard.updated_at',
        orderBy.toUpperCase(),
      );

      // Pagination
      qb.skip((page - 1) * limit).take(limit);

      const [result, total] = await qb.getManyAndCount();
      const lastPage = Math.ceil(total / limit);

      return {
        data: result,
        meta: {
          current_page: Number(page),
          from: total > 0 ? (page - 1) * limit + 1 : 0,
          last_page: lastPage,
          per_page: Number(limit),
          to: (page - 1) * limit + result.length,
          total: total,
        },
        success: true,
      };
    } catch (error) {
      this.logger.error('Error fetching user whiteboards:', error);
      throw new HttpException(
        error.message || 'Error fetching user whiteboards',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  async getAllUserWhiteboards2(
    user,
    page: number = 1,
    limit: number = 10,
    search?: string,
    projectId?: string,
    orderBy: any = 'DESC',
    sortBy: any = 'updated_at',
    group: string = 'all',
  ): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const queryBuilder =
        this.whiteboardRepository.createQueryBuilder('whiteboard');

      // ✅ Select only necessary fields, exclude heavy JSON columns initially
      queryBuilder.select([
        'whiteboard.id',
        'whiteboard.whiteboardId',
        'whiteboard.title',
        'whiteboard.description',
        'whiteboard.created_at',
        'whiteboard.updated_at',
        'whiteboard.thumbnail',
        // Don't select elements, appState, files for listing
      ]);

      // Join project and owner
      queryBuilder
        .leftJoinAndSelect('whiteboard.project', 'project')
        .leftJoin('project.user', 'owner')
        .addSelect([
          'owner.id',
          'owner.first_name',
          'owner.last_name',
          'owner.email',
          'owner.avatar',
        ]);

      // Join project peers
      queryBuilder
        .leftJoinAndSelect('project.projectPeers', 'projectPeers')
        .leftJoin('projectPeers.user', 'peerUsers')
        .addSelect([
          'peerUsers.id',
          'peerUsers.first_name',
          'peerUsers.last_name',
          'peerUsers.email',
          'peerUsers.avatar',
        ]);

      // Join tags and categories
      queryBuilder
        .leftJoinAndSelect('project.tags', 'tags')
        .leftJoinAndSelect('project.categories', 'categories');

      // Join lastModifiedBy user
      queryBuilder
        .leftJoin('whiteboard.lastModifiedBy', 'lastModifiedBy')
        .addSelect([
          'lastModifiedBy.id',
          'lastModifiedBy.first_name',
          'lastModifiedBy.last_name',
          'lastModifiedBy.email',
          'lastModifiedBy.avatar',
        ]);

      // Filter by specific project if provided
      if (projectId) {
        queryBuilder.andWhere('project.id = :projectId', {
          projectId: Number(projectId),
        });
      }

      // Apply group conditions
      switch (group) {
        case 'my':
          queryBuilder.andWhere('whiteboard.user_id = :userId', {
            userId: userFound.id,
          });
          break;

        case 'peer':
          queryBuilder.andWhere((qb) => {
            const subQuery = qb
              .subQuery()
              .select('pp.project_id')
              .from('project_peers', 'pp')
              .where('pp.user_id = :userId', { userId: userFound.id })
              .getQuery();
            return 'project.id IN ' + subQuery;
          });
          break;

        case 'all':
        default:
          queryBuilder.andWhere(
            new Brackets((qb) => {
              qb.where('owner.id = :userId', { userId: userFound.id })
                .orWhere('whiteboard.user_id = :userId', {
                  userId: userFound.id,
                })
                .orWhere((subQb) => {
                  const subQuery = subQb
                    .subQuery()
                    .select('pp.project_id')
                    .from('project_peers', 'pp')
                    .where('pp.user_id = :userId', { userId: userFound.id })
                    .getQuery();
                  return 'project.id IN ' + subQuery;
                });
            }),
          );
          break;
      }

      // Search filter
      if (search) {
        const lowered = `%${search.toLowerCase()}%`;
        queryBuilder.andWhere(
          `(LOWER(whiteboard.title) LIKE :search OR LOWER(project.title) LIKE :search OR LOWER(project.description) LIKE :search)`,
          { search: lowered },
        );
      }

      // ✅ Sort BEFORE pagination to reduce memory usage
      const sortFieldMap = {
        updated_at: 'whiteboard.updated_at',
        created_at: 'whiteboard.created_at',
        alphabetical: 'project.title',
      };

      queryBuilder.orderBy(
        sortFieldMap[sortBy] || 'whiteboard.updated_at',
        orderBy,
      );

      // ✅ Pagination - apply AFTER sorting but BEFORE loading heavy data
      queryBuilder.skip((page - 1) * limit);
      queryBuilder.take(limit);

      // Execute query
      const [result, total] = await queryBuilder.getManyAndCount();
      const lastPage = Math.ceil(total / limit);

      return {
        data: result,
        meta: {
          current_page: Number(page),
          from: total > 0 ? (page - 1) * limit + 1 : 0,
          last_page: lastPage,
          per_page: Number(limit),
          to: (page - 1) * limit + result.length,
          total: total,
        },
        success: true,
      };
    } catch (error) {
      console.error('Error fetching user whiteboards:', error);
      throw new HttpException(
        error.message || 'Error fetching user whiteboards',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
