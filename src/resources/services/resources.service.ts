import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Resource } from '../../typeorm/entities/resource';
import { Project } from '../../typeorm/entities/Project';
import { Task } from '../../typeorm/entities/Task';
import { User } from '../../typeorm/entities/User';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { UpdateResourceDto } from '../dto/update-resource.dto';
import { UploadFileDto } from '../dto/upload-file.dto';
import { FirebaseStorageService } from '../../firebase/firebase-storage.service';
import { MulterFile } from '../../types/multer.types';
import { SimplePreviewService } from '../../services/simple-preview.service';
import { UsersService } from 'src/users/services/users.service';
import { SupabaseStorageService } from 'src/supabase/supabase-storage.service';
import { Response } from 'express';
import { ActivityType } from 'src/utils/constants/activity';
import { ProjectActivitiesService } from 'src/project-activities/services/project-activities.service';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private firebaseStorageService: FirebaseStorageService,
    private supabaseStorageService: SupabaseStorageService,
    private previewService: SimplePreviewService,
    private userService: UsersService,
    private projectActivitiesService: ProjectActivitiesService,
  ) {}

  async create(
    createResourceDto: CreateResourceDto,
    user: any,
  ): Promise<Resource> {
    const { projectId, taskId, ...resourceData } = createResourceDto;

    // Verify user exists
    const userFound = await this.userRepository.findOneBy({ id: user.userId });
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    // Verify project exists
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);
    }

    // Verify task exists if provided
    let task = null;
    if (taskId) {
      task = await this.taskRepository.findOneBy({ id: taskId });
      if (!task) {
        throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);
      }
    }

    // Generate preview for link resources
    let previewData = {};
    if (resourceData.type === 'link' && resourceData.url) {
      try {
        const preview = await this.previewService.generatePreview(
          resourceData.url,
        );
        previewData = {
          preview_image: preview.image,
          preview_title: preview.title,
          preview_description: preview.description,
          preview_favicon: preview.favicon,
          preview_domain: preview.domain,
        };
      } catch (error) {
        console.warn('Failed to generate preview:', error.message);
        // Continue without preview data
      }
    }

    const resource = this.resourceRepository.create({
      ...resourceData,
      ...previewData,
      project,
      task,
      createdBy: userFound,
    });

    return await this.resourceRepository.save(resource);
  }

  async uploadFile(
    file: MulterFile,
    uploadFileDto: UploadFileDto,
    user: any,
  ): Promise<any> {
    const { projectId, taskId, ...resourceData } = uploadFileDto;

    // console.log(file, uploadFileDto, 'uploadFileDto');
    // return;
    // Verify user exists
    const userFound = await this.userRepository.findOneBy({ id: user.userId });
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    // Verify project exists
    const project = await this.projectRepository.findOneBy({
      id: Number(projectId),
    });
    if (!project) {
      throw new HttpException('Project not found', HttpStatus.BAD_REQUEST);
    }

    // Verify task exists if provided
    let task = null;
    if (taskId) {
      task = await this.taskRepository.findOneBy({ id: Number(taskId) });
      if (!task) {
        throw new HttpException('Task not found', HttpStatus.BAD_REQUEST);
      }
    }

    let fileUrl = '';
    let previewData = {};
    try {
      if (file && typeof file !== undefined) {
        const fileSize = file.size;

        const maxSize = 10 * 1024 * 1024; // 10 MB
        if (fileSize > maxSize) {
          throw new HttpException(
            'File too large. Max size is 10MB',
            HttpStatus.BAD_REQUEST,
          );
        }

        // Generate file path and upload to Supabase
        const filePath = this.supabaseStorageService.generateFilePath(
          Number(projectId),
          Number(taskId),
          file.originalname,
        );
        fileUrl = await this.supabaseStorageService.uploadFile(file, filePath);

        // Generate file path and upload to Firebase
        // const filePath = this.firebaseStorageService.generateFilePath(
        //   Number(projectId),
        //   Number(taskId),
        //   file.originalname,
        // );
        // fileUrl = await this.firebaseStorageService.uploadFile(file, filePath);

        resourceData.file_size = fileSize;
      } else {
        fileUrl = resourceData.url;
        if (resourceData.type === 'link' && resourceData.url) {
          try {
            const preview = await this.previewService.generatePreview(
              resourceData.url,
            );
            previewData = {
              preview_image: preview.image,
              preview_title: preview.title,
              preview_description: preview.description,
              preview_favicon: preview.favicon,
              preview_domain: preview.domain,
            };
          } catch (error) {
            console.warn('Failed to generate preview:', error.message);
            // Continue without preview data
          }
        }
      }

      // Create resource record
      const resource = this.resourceRepository.create({
        ...resourceData,
        type: resourceData.type || 'file',
        file_path: fileUrl,
        ...previewData,
        project,
        task,
        createdBy: userFound,
      });

      const savedResource = await this.resourceRepository.save(resource);

      await this.projectActivitiesService.createActivity({
        projectId: project.id,
        userId: userFound.id,
        activityType: ActivityType.RESOURCE_ADDED,
        description: `${userFound.fullName} added a resource: ${
          resourceData.title ?? ''
        }`,
        entityType: 'resource',
        entityId: savedResource.id,
        metadata: { resourceTitle: resourceData.title ?? '' },
      });

      return {
        success: true,
        message: 'Resource Saved Successfully',
        reource: savedResource,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to upload file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAllResources(
    user: any,
    page = 1,
    limit = 10,
    search?: string,
    projectId?: any,
    taskId?: any,
    created_by?: string,
    type?: string,
  ): Promise<any> {
    const foundUser = await this.userService.getUserAccountById(user.userId);
    if (!foundUser) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    const queryBuilder = this.resourceRepository
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.project', 'project')
      .leftJoinAndSelect('resource.task', 'task')
      .leftJoinAndSelect('resource.createdBy', 'createdBy');

    if (search) {
      const lowered = `%${search.toLowerCase()}%`;
      queryBuilder.andWhere(
        `(LOWER(resource.title) LIKE :search OR LOWER(resource.description) LIKE :search)`,
        { search: lowered },
      );
    }

    if (projectId) {
      queryBuilder.andWhere('resource.project.id = :projectId', { projectId });
    }

    if (taskId) {
      queryBuilder.andWhere('resource.task.id = :taskId', { taskId });
    }

    if (created_by) {
      switch (created_by) {
        case 'me':
          queryBuilder.andWhere('resource.createdBy.id = :userId', {
            userId: foundUser.id,
          });
          break;

        case 'peers':
          if (projectId) {
            // Only peers in the same project
            queryBuilder.andWhere(
              `resource.createdBy.id IN (
                SELECT pp.user_id
                FROM project_peers pp
                WHERE pp.project_id = :projectId
                  AND pp.user_id != :userId
              )`,
              { userId: foundUser.id, projectId },
            );
          } else {
            // Peers across all projects the user belongs to
            queryBuilder.andWhere(
              `resource.createdBy.id IN (
                SELECT DISTINCT pp2.user_id
                FROM project_peers pp
                WHERE pp.user_id = :userId
                JOIN project_peers pp2 ON pp.project_id = pp2.project_id
                WHERE pp2.user_id != :userId
              )`,
              { userId: foundUser.id },
            );
          }
          break;

        case 'all':
        default:
          if (projectId) {
            // All resources within the same project
            queryBuilder.andWhere(
              `(
                resource.createdBy.id = :userId
                OR resource.createdBy.id IN (
                  SELECT pp.user_id
                  FROM project_peers pp
                  WHERE pp.project_id = :projectId
                )
              )`,
              { userId: foundUser.id, projectId },
            );
          } else {
            // All my resources and my peers’ resources across all my projects
            queryBuilder.andWhere(
              `(
                resource.createdBy.id = :userId
                OR resource.createdBy.id IN (
                  SELECT DISTINCT pp2.user_id
                  FROM project_peers pp
                  JOIN project_peers pp2 ON pp.project_id = pp2.project_id
                  WHERE pp.user_id = :userId
                )
              )`,
              { userId: foundUser.id },
            );
          }
          break;
      }
    }

    if (type) {
      queryBuilder.andWhere('resource.type', { type });
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [result, total] = await queryBuilder.getManyAndCount();
    const lastPage = Math.ceil(total / limit);

    // console.log(result, 'result')
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
      success: true,
    };
  }

  async findAll(projectId?: number, taskId?: number): Promise<Resource[]> {
    const queryBuilder = this.resourceRepository
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.project', 'project')
      .leftJoinAndSelect('resource.task', 'task')
      .leftJoinAndSelect('resource.createdBy', 'createdBy');

    if (projectId) {
      queryBuilder.andWhere('resource.project.id = :projectId', { projectId });
    }

    if (taskId) {
      queryBuilder.andWhere('resource.task.id = :taskId', { taskId });
    }

    return await queryBuilder.getMany();
  }

  async findOne(id: number): Promise<Resource> {
    const resource = await this.resourceRepository.findOne({
      where: { id },
      relations: ['project', 'task', 'createdBy'],
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }

    return resource;
  }

  async update(
    id: number,
    updateResourceDto: UpdateResourceDto,
    user: any,
  ): Promise<Resource> {
    const resource = await this.findOne(id);

    // Verify user has permission (created by user or project owner)
    const userFound = await this.userRepository.findOneBy({ id: user.userId });
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    if (
      resource.createdBy.id !== userFound.id &&
      resource.project.user.id !== userFound.id
    ) {
      throw new HttpException(
        'Unauthorized to update this resource',
        HttpStatus.FORBIDDEN,
      );
    }

    // Update resource
    Object.assign(resource, updateResourceDto);
    return await this.resourceRepository.save(resource);
  }

  async remove(id: number, user: any): Promise<void> {
    const resource = await this.findOne(id);

    // Verify user has permission (created by user or project owner)
    const userFound = await this.userRepository.findOneBy({ id: user.userId });
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    if (
      resource.createdBy.id !== userFound.id &&
      resource.project.user.id !== userFound.id
    ) {
      throw new HttpException(
        'Unauthorized to delete this resource',
        HttpStatus.FORBIDDEN,
      );
    }

    // Delete file from Firebase if it exists
    if (resource.file_path) {
      try {
        // Extract file path from Firebase URL
        const url = new URL(resource.file_path);
        const filePath = url.pathname.split('/o/')[1]?.split('?')[0];
        if (filePath) {
          await this.firebaseStorageService.deleteFile(
            decodeURIComponent(filePath),
          );
        }
      } catch (error) {
        console.error('Failed to delete file from Firebase:', error);
        // Continue with database deletion even if file deletion fails
      }
    }

    await this.projectActivitiesService.createActivity({
      projectId: resource.project.id,
      userId: userFound.id,
      activityType: ActivityType.RESOURCE_DELETED,
      description: `${userFound.fullName} deleted a resource: ${
        resource.title ?? ''
      }`,
      entityType: 'resource',
      entityId: resource.id,
      metadata: { resourceTitle: resource.title ?? '' },
    });

    await this.resourceRepository.remove(resource);
  }

  /**
   * Download file
   */

  async downloadFile(id: number, user: any, res: Response): Promise<void> {
    const resource = await this.findOne(id);

    // Check permissions
    const userFound = await this.userRepository.findOneBy({ id: user.userId });
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    if (!resource.file_path) {
      throw new HttpException(
        'No file associated with this resource',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Extract file path from URL
      const url = new URL(resource.file_path);

      // For public URLs: /storage/v1/object/public/{bucket}/{path}
      // We need to extract everything after the bucket name
      const pathParts = url.pathname.split('/');
      const publicIndex = pathParts.indexOf('public');

      if (publicIndex === -1) {
        throw new Error('Invalid storage URL format');
      }

      // Skip 'public' and bucket name, get the rest
      const filePath = pathParts.slice(publicIndex + 2).join('/');

      console.log('Extracted file path:', filePath);

      // Download from Supabase
      const fileBlob = await this.supabaseStorageService.downloadFile(
        decodeURIComponent(filePath),
      );

      // Convert Blob to Buffer
      const arrayBuffer = await fileBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Set headers and send
      res.set({
        'Content-Type': fileBlob.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${resource.title}"`,
        'Content-Length': buffer.length,
      });

      console.log(buffer);
      res.send(buffer);
    } catch (error) {
      console.error('Download error:', error);
      throw new HttpException(
        `Failed to download file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async downloadFile2(id: number, user: any, res: Response): Promise<void> {
    const resource = await this.findOne(id);
    const userFound = await this.userRepository.findOneBy({ id: user.userId });

    if (!userFound)
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    if (!resource.file_path)
      throw new HttpException(
        'No file associated with this resource',
        HttpStatus.BAD_REQUEST,
      );

    try {
      const url = new URL(resource.file_path);
      const pathParts = url.pathname.split('/');
      const publicIndex = pathParts.indexOf('public');
      if (publicIndex === -1) throw new Error('Invalid storage URL format');

      const filePath = pathParts.slice(publicIndex + 2).join('/');
      const fileBlob = await this.supabaseStorageService.downloadFile(
        decodeURIComponent(filePath),
      );
      const arrayBuffer = await fileBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fileName = `${resource.title}${path.extname(filePath) || ''}`;

      res.set({
        'Content-Type': fileBlob.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length,
      });

      res.send(buffer);
    } catch (error) {
      console.error('Download error:', error);
      throw new HttpException(
        `Failed to download file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // async downloadFile2(
  //   id: number,
  //   user: any,
  //   res: Response,
  // ): Promise<StreamableFile> {
  //   const resource = await this.findOne(id);

  //   // Check permissions
  //   const userFound = await this.userRepository.findOneBy({ id: user.userId });
  //   if (!userFound) {
  //     throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
  //   }

  //   // Verify user has access to this project
  //   // Add your permission logic here

  //   if (!resource.file_path) {
  //     throw new HttpException(
  //       'No file associated with this resource',
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }

  //   try {
  //     // Extract file path from URL
  //     const url = new URL(resource.file_path);
  //     const pathParts = url.pathname.split('/');
  //     const filePath = pathParts
  //       .slice(pathParts.indexOf('object') + 2)
  //       .join('/');

  //     // Download from Supabase
  //     const fileBlob = await this.supabaseStorageService.downloadFile(
  //       decodeURIComponent(filePath),
  //     );

  //     // Convert Blob to Buffer
  //     const buffer = Buffer.from(await fileBlob.arrayBuffer());

  //     // Set headers
  //     res.set({
  //       'Content-Type': fileBlob.type || 'application/octet-stream',
  //       'Content-Disposition': `attachment; filename="${resource.title}"`,
  //       'Content-Length': buffer.length,
  //     });

  //     return new StreamableFile(buffer);
  //   } catch (error) {
  //     throw new HttpException(
  //       `Failed to download file: ${error.message}`,
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  /**
   * Get signed URL for preview/direct access
   */
  async getFileUrl(
    id: number,
    user: any,
  ): Promise<{ url: string; expiresIn: number }> {
    const resource = await this.findOne(id);

    // Check permissions
    const userFound = await this.userRepository.findOneBy({ id: user.userId });
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    // Verify user has access to this project
    // Add your permission logic here

    if (!resource.file_path) {
      throw new HttpException(
        'No file associated with this resource',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Extract file path from URL
      const url = new URL(resource.file_path);

      // For public URLs: /storage/v1/object/public/{bucket}/{path}
      // We need to extract everything after the bucket name
      const pathParts = url.pathname.split('/');
      const publicIndex = pathParts.indexOf('public');

      if (publicIndex === -1) {
        throw new Error('Invalid storage URL format');
      }

      // Skip 'public' and bucket name, get the rest
      const filePath = pathParts.slice(publicIndex + 2).join('/');

      console.log('Extracted file path:', filePath);

      // Get signed URL (expires in 1 hour)
      const signedUrl = await this.supabaseStorageService.getSignedUrl(
        decodeURIComponent(filePath),
        3600, // 1 hour
      );

      return {
        url: signedUrl,
        expiresIn: 3600,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate file URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByProject(projectId: number): Promise<Resource[]> {
    return await this.resourceRepository.find({
      where: { project: { id: projectId } },
      relations: ['project', 'task', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByTask(taskId: number): Promise<Resource[]> {
    return await this.resourceRepository.find({
      where: { task: { id: taskId } },
      relations: ['project', 'task', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }
}
