import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Folder } from 'src/typeorm/entities/Folder';
import { IsNull, Repository, TreeRepository } from 'typeorm';
import { CreateFolderDto } from '../dtos/create-folder.dto';
import { UpdateFolderDto } from '../dtos/update-folder.dto';
import { UsersService } from 'src/users/services/users.service';
import { Document } from 'src/typeorm/entities/Document';
import { Organization } from 'src/typeorm/entities/Organization';
import { TenantQueryHelper } from 'src/common/helpers/tenant-query.helper';

@Injectable()
export class FoldersService {
  constructor(
    private usersService: UsersService,

    @InjectRepository(Folder)
    private foldersRepository: TreeRepository<Folder>,
    @InjectRepository(Document)
    private documentsRepository: TreeRepository<Document>,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
  ) {}

  async create(
    createFolderDto: CreateFolderDto,
    user: any,
    organizationId: string,
  ): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const organization = await this.orgRepository.findOne({
        where: { id: organizationId },
      });

      // If parentId is provided, verify it exists and belongs to user
      if (createFolderDto.parentId) {
        const parentFolder = await this.findOne(
          createFolderDto.parentId,
          userFound.id,
          organization.id,
        );
        if (!parentFolder) {
          throw new NotFoundException('Parent folder not found');
        }
      }

      const folder = this.foldersRepository.create({
        ...createFolderDto,
        owner: userFound,
        userId: userFound.id,
        organization_id: organization.id,
        organization,
      });

      const savedFolder = await this.foldersRepository.save(folder);

      return {
        data: savedFolder,
        success: true,
        message: 'success',
      };
    } catch (err) {}
  }

  async findAll(
    user: any,
    organizationId: string,
    group: string,
  ): Promise<Folder[]> {
    const userFound = await this.usersService.getUserAccountById(user.userId);
    console.log(userFound, 'www');
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    const userId = userFound.id;

    // Get all folders for the user
    if (group == 'mine') {
      return await this.foldersRepository.find({
        where: { userId: userId, organization_id: organizationId },
        relations: ['documents'],
        order: { createdAt: 'DESC' },
      });
    }

    return await this.foldersRepository.find({
      where: { organization_id: organizationId },
      relations: ['documents'],
      order: { createdAt: 'DESC' },
    });
  }

  // folders.service.ts - Updated to include documents
  async findAllWithTree(
    user: any,
    organizationId: string,
    group: string,
  ): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);

      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;

      // Get all folders with document counts
      const folders = await this.foldersRepository
        .createQueryBuilder('folder')
        .leftJoin('folder.documents', 'documents')
        .select([
          'folder.id',
          'folder.name',
          'folder.parentId',
          'folder.color',
          'folder.icon',
          'folder.description',
          'folder.createdAt',
          'folder.updatedAt',
        ])
        .addSelect('COUNT(documents.id)', 'documentCount');
      // .where('folder.userId = :userId', { userId })

      // .andWhere('folder.organization_id = :organizationId', {
      //   organizationId,
      // })
      // .groupBy('folder.id')
      // .orderBy('folder.name', 'ASC')
      // .getRawAndEntities();

      let folderResult: { raw: any[]; entities: Folder[] };

      if (group === 'mine') {
        folderResult = await folders
          .where('folder.userId = :userId', { userId })
          .andWhere('folder.organization_id = :organizationId', {
            organizationId,
          })
          .andWhere('folder.is_public = :is_public', { is_public: false })
          .groupBy('folder.id')
          .orderBy('folder.name', 'ASC')
          .getRawAndEntities();
      } else {
        folderResult = await folders
          .where('folder.organization_id = :organizationId', { organizationId })
          .andWhere('folder.is_public = :is_public', { is_public: true })
          .groupBy('folder.id')
          .orderBy('folder.name', 'ASC')
          .getRawAndEntities();
      }

      const foldersEntities = folderResult.entities;
      const foldersRaw = folderResult.raw;
      // Get all documents for these folders

      const documentsList = await this.documentsRepository
        .createQueryBuilder('document')
        .leftJoinAndSelect('document.files', 'files')
        .select([
          'document.id',
          'document.title',
          'document.folderId',
          'document.content',
          'document.plainText',
          'document.isPublished',
          'document.isFavorite',
          'document.createdAt',
          'document.updatedAt',
          'document.metadata',
          'files.id',
          'files.filename',
          'files.size',
          'files.mimeType',
        ])
        // .where('document.userId = :userId', {
        //   userId,
        // })
        .where('document.organization_id = :organizationId', {
          organizationId,
        })
        .andWhere('document.folderId IS NOT NULL')
        .orderBy('document.title', 'ASC')
        .getMany();

      // const documents = await this.documentsRepository
      //   .createQueryBuilder('document')
      //   .leftJoinAndSelect('document.files', 'files')
      //   .select([
      //     'document.id',
      //     'document.title',
      //     'document.folderId',
      //     'document.content',
      //     'document.plainText',
      //     'document.isPublished',
      //     'document.isFavorite',
      //     'document.createdAt',
      //     'document.updatedAt',
      //     'document.metadata',
      //   ])
      //   .addSelect('files.id')
      //   .addSelect('files.filename')
      //   .addSelect('files.size')
      //   .addSelect('files.mimeType')
      //   .where('document.userId = :userId', { userId })
      //   .andWhere('document.organization_id = :organizationId', {
      //     organizationId,
      //   })
      //   .andWhere('document.folderId IS NOT NULL')
      //   .orderBy('document.title', 'ASC')
      //   .getMany();

      // Early return if no folders
      if (foldersEntities.length === 0) {
        return {
          data: [],
          success: true,
          message: 'success',
          error: null,
        };
      }

      // Group documents by folderId
      const documentsByFolder = new Map<string, any[]>();
      documentsList.forEach((doc) => {
        if (doc.folderId) {
          if (!documentsByFolder.has(doc.folderId)) {
            documentsByFolder.set(doc.folderId, []);
          }
          documentsByFolder.get(doc.folderId)!.push(doc);
        }
      });

      // Build tree efficiently (O(n) complexity)
      const folderMap = new Map();
      const rootFolders = [];

      // Single pass to create map with documents
      for (let i = 0; i < foldersEntities.length; i++) {
        const folder = foldersEntities[i];
        const documentCount = parseInt(foldersRaw[i].documentCount) || 0;

        folderMap.set(folder.id, {
          ...folder,
          children: [],
          documents: documentsByFolder.get(folder.id) || [],
          documentCount,
          stats: {
            directDocuments: documentCount,
            totalDocuments: documentCount, // Will be calculated recursively
          },
        });
      }

      // Single pass to build relationships
      for (const folder of foldersEntities) {
        const current = folderMap.get(folder.id);

        if (folder.parentId) {
          const parent = folderMap.get(folder.parentId);
          if (parent) {
            parent.children.push(current);
          } else {
            // Orphaned folder, treat as root
            rootFolders.push(current);
          }
        } else {
          rootFolders.push(current);
        }
      }

      // Calculate total documents recursively
      const calculateTotals = (folder: any): number => {
        let total = folder.documentCount || 0;
        if (folder.children && folder.children.length > 0) {
          for (const child of folder.children) {
            total += calculateTotals(child);
          }
        }
        folder.stats.totalDocuments = total;
        return total;
      };

      rootFolders.forEach(calculateTotals);

      return {
        data: rootFolders,
        success: true,
        message: 'success',
        error: null,
      };
    } catch (err) {
      console.error('Find folders tree error:', err);
      throw new HttpException(
        err?.message || 'Failed to retrieve folders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Get single folder with full details
  async findFolderById(
    user: any,
    folderId: string,
    organizationId: string,
  ): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);

      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;

      // Get folder
      const folder = await this.foldersRepository.findOne({
        where: { id: folderId, userId },
      });

      if (!folder) {
        throw new HttpException('Folder not found', HttpStatus.NOT_FOUND);
      }

      // Get documents in this folder
      const documents = await this.documentsRepository
        .createQueryBuilder('document')
        .leftJoinAndSelect('document.files', 'files')
        .leftJoinAndSelect('document.category', 'category')
        .where('document.folderId = :folderId', { folderId })
        .andWhere('document.userId = :userId', { userId })
        .andWhere('document.organization_id = :organizationId', {
          organizationId,
        })
        .orderBy('document.updatedAt', 'DESC')
        .getMany();

      // Get subfolders
      const subfolders = await this.foldersRepository.find({
        where: { parentId: folderId, userId, organization_id: organizationId },
        order: { name: 'ASC' },
      });

      // Calculate stats
      const totalSize = documents.reduce((total, doc) => {
        const docSize =
          doc.files?.reduce((sum, file) => sum + (file.size || 0), 0) || 0;
        return total + docSize;
      }, 0);

      return {
        data: {
          ...folder,
          documents,
          subfolders,
          stats: {
            documentCount: documents.length,
            subfolderCount: subfolders.length,
            totalSize,
          },
        },
        success: true,
        message: 'success',
        error: null,
      };
    } catch (err) {
      console.error('Find folder by id error:', err);
      throw new HttpException(
        err?.message || 'Failed to retrieve folder',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAllWithTree1(user: any): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);

      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;

      // Single optimized query with all needed data
      const folders = await this.foldersRepository
        .createQueryBuilder('folder')
        .select([
          'folder.id',
          'folder.name',
          'folder.parentId',
          'folder.color',
          'folder.icon',
          'folder.description',
          'folder.createdAt',
          'folder.updatedAt',
        ])
        .where('folder.userId = :userId', { userId })
        .orderBy('folder.name', 'ASC')
        .getMany();

      // Early return if no folders
      if (folders.length === 0) {
        return {
          data: [],
          success: true,
          message: 'success',
          error: null,
        };
      }

      // Build tree efficiently (O(n) complexity)
      const folderMap = new Map();
      const rootFolders = [];

      // Single pass to create map
      for (const folder of folders) {
        folderMap.set(folder.id, { ...folder, children: [] });
      }

      // Single pass to build relationships
      for (const folder of folders) {
        const current = folderMap.get(folder.id);

        if (folder.parentId) {
          const parent = folderMap.get(folder.parentId);
          if (parent) {
            parent.children.push(current);
          } else {
            // Orphaned folder, treat as root
            rootFolders.push(current);
          }
        } else {
          rootFolders.push(current);
        }
      }

      return {
        data: rootFolders,
        success: true,
        message: 'success',
        error: null,
      };
    } catch (err) {
      console.error('Find folders tree error:', err);
      throw new HttpException(
        err?.message || 'Failed to retrieve folders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAllWithTree2(user: any): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      console.log(userFound, 'www');
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;
      // Get root folders (no parent) with their entire tree
      const rootFolders = await this.foldersRepository.find({
        where: { userId, parentId: IsNull() },
      });

      // For each root folder, get its descendants
      const foldersWithTree = await Promise.all(
        rootFolders.map(async (folder) => {
          return await this.foldersRepository.findDescendantsTree(folder);
        }),
      );

      return {
        data: foldersWithTree,
        success: true,
        message: 'success',
      };
    } catch (err) {}
  }

  async findOne(
    id: string,
    userId: number,
    organizationId: string,
  ): Promise<Folder> {
    const folder = await this.foldersRepository.findOne({
      where: { id, organization_id: organizationId },
      relations: ['documents', 'children', 'parent'],
    });

    if (!folder) {
      throw new NotFoundException(`Folder with ID ${id} not found`);
    }

    if (folder.userId !== userId) {
      throw new ForbiddenException('You do not have access to this folder');
    }

    return folder;
  }

  async findOneWithContents(
    id: string,
    userId: number,
    organizationId: string,
  ): Promise<Folder> {
    const folder = await this.findOne(id, userId, organizationId);

    // Get immediate children folders
    const children = await this.foldersRepository.find({
      where: { parentId: id, userId, organization_id: organizationId },
      relations: ['documents'],
    });

    folder.children = children;

    return folder;
  }

  async findRecentFolders2(user: any): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      console.log(userFound, 'www');
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;

      // recent
      const recentquery = this.foldersRepository
        .createQueryBuilder('folder')
        .where('folder.userId = :userId', { userId })
        .orderBy('folder.updatedAt', 'DESC')
        .limit(10);

      const recentdata = await recentquery.getMany();

      console.log(recentdata, 'recent');
      return {
        data: recentdata,
        success: true,
        message: 'Success',
        error: null,
      };
    } catch (err) {
      console.log(err?.message, err);
    }
  }

  async update(
    id: string,
    updateFolderDto: UpdateFolderDto,
    user: any,
    organizationId: string,
  ): Promise<any> {
    try {
      console.log(updateFolderDto, 'entered');
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const folder = await this.findOne(id, userFound.id, organizationId);

      console.log(updateFolderDto, 'entered');
      // If moving to a new parent, validate it
      if (
        updateFolderDto.parentId &&
        updateFolderDto.parentId !== folder.parentId
      ) {
        // Check if new parent exists
        const newParent = await this.findOne(
          updateFolderDto.parentId,
          userFound.id,
          organizationId,
        );

        // Prevent circular reference (folder cannot be its own ancestor)
        const descendants =
          await this.foldersRepository.findDescendants(folder);
        if (descendants.some((d) => d.id === updateFolderDto.parentId)) {
          throw new BadRequestException(
            'Cannot move folder into its own subfolder',
          );
        }
      }

      Object.assign(folder, updateFolderDto);
      const updatedFolder = await this.foldersRepository.save(folder);

      return {
        data: updatedFolder,
        success: true,
        message: 'Updated Successfully',
      };
    } catch (err) {
      throw err;
    }
  }

  // Move a folder to a new parent
  async moveFolder(
    user: any,
    folderId: string,
    targetParentId: string,
  ): Promise<any> {
    try {
      const folder = await this.foldersRepository.findOne({
        where: { id: folderId, userId: user.userId },
      });

      if (!folder) {
        throw new HttpException('Folder not found', HttpStatus.NOT_FOUND);
      }

      // Validate target parent
      if (targetParentId) {
        const targetParent = await this.foldersRepository.findOne({
          where: { id: targetParentId, userId: user.userId },
        });

        if (!targetParent) {
          throw new HttpException(
            'Target folder not found',
            HttpStatus.NOT_FOUND,
          );
        }

        // Prevent moving folder into itself or its descendants
        const descendants = await this.foldersRepository
          .createQueryBuilder('folder')
          .innerJoin(
            'folders_closure',
            'closure',
            'closure.id_descendant = folder.id',
          )
          .where('closure.id_ancestor = :folderId', { folderId })
          .getMany();

        const descendantIds = descendants.map((f) => f.id);
        if (descendantIds.includes(targetParentId)) {
          throw new HttpException(
            'Cannot move folder into itself or its descendants',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      folder.parentId = targetParentId || null;
      const updatedFolder = await this.foldersRepository.save(folder);

      return {
        success: true,
        message: 'Folder moved successfully',
        data: updatedFolder,
      };
    } catch (err) {
      console.error('Move folder error:', err);
      throw new HttpException(
        err.message || 'Failed to move folder',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string, user: any, organizationId: string): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const folder = await this.findOne(id, userFound.id, organizationId);
      if (!folder) {
        throw new BadRequestException('Folder not found');
      }

      // 1. Check for subfolders
      const childCount = await this.foldersRepository.count({
        where: { parentId: id },
      });

      if (childCount > 0) {
        throw new BadRequestException(
          'Cannot delete folder with subfolders. Delete or move subfolders first.',
        );
      }

      // 2. Check for documents
      const documentCount = await this.documentsRepository.count({
        where: { folderId: id },
      });

      if (documentCount > 0) {
        throw new BadRequestException(
          'Cannot delete folder containing documents. Move or delete documents first.',
        );
      }

      // 3. Now it's safe to delete
      await this.foldersRepository.remove(folder);

      return {
        success: true,
        message: 'Deleted Successfully',
      };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  async getAncestors(
    id: string,
    userId: number,
    organizationId: string,
  ): Promise<Folder[]> {
    const folder = await this.findOne(id, userId, organizationId);
    return await this.foldersRepository.findAncestors(folder);
  }

  async getDescendants(
    id: string,
    userId: number,
    organizationId: string,
  ): Promise<Folder[]> {
    const folder = await this.findOne(id, userId, organizationId);
    return await this.foldersRepository.findDescendants(folder);
  }

  async getBreadcrumbs(
    id: string,
    userId: number,
    organizationId: string,
  ): Promise<Folder[]> {
    const ancestors = await this.getAncestors(id, userId, organizationId);
    return ancestors.reverse(); // Root -> Current
  }

  async findRecentFolders(user: any, organizationId: string): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;

      // Get recent folders with basic info
      const recentFolders = await this.foldersRepository
        .createQueryBuilder('folder')
        .where('folder.userId = :userId', { userId })
        .andWhere('folder.parentId IS NULL')
        .orderBy('folder.updatedAt', 'DESC')
        .limit(10)
        .getMany();

      // Enrich each folder with recursive stats
      const enrichedFolders = await Promise.all(
        recentFolders.map(async (folder) => {
          const stats = await this.getFolderStatsOptimized(folder.id);
          return {
            ...folder,
            stats,
          };
        }),
      );

      return {
        data: enrichedFolders,
        success: true,
        message: 'Success',
        error: null,
      };
    } catch (err) {
      console.log(err?.message, err);
      throw err;
    }
  }

  // Recursive function to get folder statistics
  async getFolderStatsRecursive(folderId: string): Promise<{
    totalFiles: number;
    totalSubfolders: number;
    totalSize: number;
    directFiles: number;
    directSubfolders: number;
  }> {
    // Get direct subfolders
    const directSubfolders = await this.foldersRepository
      .createQueryBuilder('folder')
      .where('folder.parentId = :folderId', { folderId })
      .getMany();

    // Get direct files in this folder
    const directFiles = await this.documentsRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.files', 'files')
      .where('document.folderId = :folderId', { folderId })
      .getMany();

    // Calculate size of direct files
    const directSize = directFiles.reduce((total, doc) => {
      const docSize =
        doc.files?.reduce((sum, file) => sum + (file.size || 0), 0) || 0;
      return total + docSize;
    }, 0);

    // Initialize counters
    let totalFiles = directFiles.length;
    let totalSubfolders = directSubfolders.length;
    let totalSize = directSize;

    // Recursively get stats from subfolders
    for (const subfolder of directSubfolders) {
      const subStats = await this.getFolderStatsRecursive(subfolder.id);
      totalFiles += subStats.totalFiles;
      totalSubfolders += subStats.totalSubfolders;
      totalSize += subStats.totalSize;
    }

    return {
      totalFiles,
      totalSubfolders,
      totalSize,
      directFiles: directFiles.length,
      directSubfolders: directSubfolders.length,
    };
  }

  // Alternative: Get folder tree with stats for a single folder
  async getFolderTreeWithStats(folderId: string): Promise<any> {
    const folder = await this.foldersRepository.findOne({
      where: { id: folderId },
    });

    if (!folder) {
      throw new HttpException('Folder not found', HttpStatus.NOT_FOUND);
    }

    // Get direct children (subfolders)
    const subfolders = await this.foldersRepository
      .createQueryBuilder('folder')
      .where('folder.parentId = :folderId', { folderId })
      .getMany();

    // Get direct documents
    const documents = await this.documentsRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.files', 'files')
      .where('document.folderId = :folderId', { folderId })
      .getMany();

    // Calculate stats for current folder
    const directSize = documents.reduce((total, doc) => {
      const docSize =
        doc.files?.reduce((sum, file) => sum + (file.size || 0), 0) || 0;
      return total + docSize;
    }, 0);

    // Recursively build tree with stats
    const childrenWithStats = await Promise.all(
      subfolders.map(async (subfolder) => {
        return await this.getFolderTreeWithStats(subfolder.id);
      }),
    );

    // Aggregate stats from children
    const childStats = childrenWithStats.reduce(
      (acc, child) => ({
        totalFiles: acc.totalFiles + child.stats.totalFiles,
        totalSubfolders: acc.totalSubfolders + child.stats.totalSubfolders + 1,
        totalSize: acc.totalSize + child.stats.totalSize,
      }),
      { totalFiles: 0, totalSubfolders: 0, totalSize: 0 },
    );

    return {
      ...folder,
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        size: doc.files?.reduce((sum, file) => sum + (file.size || 0), 0) || 0,
        fileCount: doc.files?.length || 0,
      })),
      children: childrenWithStats,
      stats: {
        directFiles: documents.length,
        directSubfolders: subfolders.length,
        directSize: directSize,
        totalFiles: documents.length + childStats.totalFiles,
        totalSubfolders: childStats.totalSubfolders,
        totalSize: directSize + childStats.totalSize,
      },
    };
  }

  // Optimized version using CTE (Common Table Expression) - More efficient
  async getFolderStatsOptimized(folderId: string): Promise<any> {
    // Get all descendant folders using closure table
    const descendantFolders = await this.foldersRepository
      .createQueryBuilder('folder')
      .innerJoin(
        'folders_closure',
        'closure',
        'closure.id_descendant = folder.id',
      )
      .where('closure.id_ancestor = :folderId', { folderId })
      .getMany();

    const folderIds = [folderId, ...descendantFolders.map((f) => f.id)];

    // Get all documents in these folders with their files
    const documents = await this.documentsRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.files', 'files')
      .where('document.folderId IN (:...folderIds)', { folderIds })
      .getMany();

    // Calculate stats
    const totalFiles = documents.length;
    const totalSubfolders = descendantFolders.length;
    const totalSize = documents.reduce((total, doc) => {
      const docSize =
        doc.files?.reduce((sum, file) => sum + (file.size || 0), 0) || 0;
      return total + docSize;
    }, 0);

    // Get direct counts
    const directDocuments = documents.filter(
      (doc) => doc.folderId === folderId,
    );
    const directSubfolders = descendantFolders.filter(
      (f) => f.parentId === folderId,
    );

    const directSize = directDocuments.reduce((total, doc) => {
      const docSize =
        doc.files?.reduce((sum, file) => sum + (file.size || 0), 0) || 0;
      return total + docSize;
    }, 0);

    return {
      totalFiles,
      totalSubfolders,
      totalSize,
      directFiles: directDocuments.length,
      directSubfolders: directSubfolders.length,
      directSize,
    };
  }
}
