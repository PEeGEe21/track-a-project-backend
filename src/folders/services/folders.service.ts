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
import { IsNull, TreeRepository } from 'typeorm';
import { CreateFolderDto } from '../dtos/create-folder.dto';
import { UpdateFolderDto } from '../dtos/update-folder.dto';
import { UsersService } from 'src/users/services/users.service';
import { Document } from 'src/typeorm/entities/Document';

@Injectable()
export class FoldersService {
  constructor(
    private usersService: UsersService,

    @InjectRepository(Folder)
    private foldersRepository: TreeRepository<Folder>,
    @InjectRepository(Document)
    private documentsRepository: TreeRepository<Document>,
  ) {}

  async create(createFolderDto: CreateFolderDto, user: any): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      // If parentId is provided, verify it exists and belongs to user
      if (createFolderDto.parentId) {
        const parentFolder = await this.findOne(
          createFolderDto.parentId,
          userFound.id,
        );
        if (!parentFolder) {
          throw new NotFoundException('Parent folder not found');
        }
      }

      const folder = this.foldersRepository.create({
        ...createFolderDto,
        owner: userFound,
        userId: userFound.id,
      });

      const savedFolder = await this.foldersRepository.save(folder);

      return {
        data: savedFolder,
        success: true,
        message: 'success',
      };
    } catch (err) {}
  }

  async findAll(userId: number): Promise<Folder[]> {
    // Get all folders for the user
    return await this.foldersRepository.find({
      where: { userId },
      relations: ['documents'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAllWithTree(userId: number): Promise<Folder[]> {
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

    return foldersWithTree;
  }

  async findOne(id: string, userId: number): Promise<Folder> {
    const folder = await this.foldersRepository.findOne({
      where: { id },
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

  async findOneWithContents(id: string, userId: number): Promise<Folder> {
    const folder = await this.findOne(id, userId);

    // Get immediate children folders
    const children = await this.foldersRepository.find({
      where: { parentId: id, userId },
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
  ): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const folder = await this.findOne(id, userFound.id);

      // If moving to a new parent, validate it
      if (
        updateFolderDto.parentId &&
        updateFolderDto.parentId !== folder.parentId
      ) {
        // Check if new parent exists
        const newParent = await this.findOne(
          updateFolderDto.parentId,
          userFound.id,
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
    } catch (err) {}
  }

  async remove(id: string, user: any): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const folder = await this.findOne(id, userFound.id);

      // Check if folder has children
      const descendants = await this.foldersRepository.findDescendants(folder);
      if (descendants.length > 1) {
        // More than just itself
        throw new BadRequestException(
          'Cannot delete folder with subfolders. Delete or move subfolders first.',
        );
      }

      // Documents will be set to null (folderId) due to SET NULL on delete
      await this.foldersRepository.remove(folder);

      return {
        success: true,
        message: 'Deleted Successfully',
      };
    } catch (err) {}
  }

  async getAncestors(id: string, userId: number): Promise<Folder[]> {
    const folder = await this.findOne(id, userId);
    return await this.foldersRepository.findAncestors(folder);
  }

  async getDescendants(id: string, userId: number): Promise<Folder[]> {
    const folder = await this.findOne(id, userId);
    return await this.foldersRepository.findDescendants(folder);
  }

  async getBreadcrumbs(id: string, userId: number): Promise<Folder[]> {
    const ancestors = await this.getAncestors(id, userId);
    return ancestors.reverse(); // Root -> Current
  }

  async findRecentFolders(user: any): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      console.log(userFound, 'www');

      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;

      // Get recent folders with basic info
      const recentFolders = await this.foldersRepository
        .createQueryBuilder('folder')
        .where('folder.userId = :userId', { userId })
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

      console.log(enrichedFolders, 'recent');

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
