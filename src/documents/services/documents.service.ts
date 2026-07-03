import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { Document } from 'src/typeorm/entities/Document';
import { DocumentFile } from 'src/typeorm/entities/DocumentFile';
import { Folder } from 'src/typeorm/entities/Folder';
import { UsersService } from 'src/users/services/users.service';
import { StorageService } from 'src/types/storage.interface';
import { MulterFile } from 'src/types/multer.types';

@Injectable()
export class DocumentsService {
  constructor(
    private usersService: UsersService,

    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    @InjectRepository(DocumentFile)
    private filesRepository: Repository<DocumentFile>,
    @InjectRepository(Folder)
    private foldersRepository: Repository<Folder>,
    @Inject('STORAGE_SERVICE')
    private storageService: StorageService,
  ) {}

  async create(
    createDocumentDto: CreateDocumentDto,
    user: any,
    organizationId?: string | null,
  ): Promise<Document> {
    const userFound = await this.getUserOrThrow(user);
    const plainText =
      createDocumentDto.plainText ??
      this.extractPlainText(createDocumentDto.content);
    const metadata = this.calculateMetadata(createDocumentDto.content);

    const document = this.documentsRepository.create({
      ...createDocumentDto,
      plainText,
      author: userFound,
      userId: userFound.id,
      metadata,
      organization_id: organizationId ?? null,
      publishedAt: createDocumentDto.isPublished ? new Date() : null,
    });

    return await this.documentsRepository.save(document);
  }

  async findAll(
    user: any,
    page: number = 1,
    limit: number = 10,
    search?: string,
    organizationId?: string | null,
  ): Promise<any> {
    const userFound = await this.getUserOrThrow(user);
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentLimit = Math.max(Number(limit) || 10, 1);

    const query = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.userId = :userId', { userId: userFound.id })
      .leftJoinAndSelect('document.folder', 'folder')
      .leftJoinAndSelect('document.files', 'files')
      .orderBy('document.updatedAt', 'DESC');

    this.applyOrganizationScope(query, 'document', organizationId);

    if (search) {
      const lowered = `%${search.toLowerCase()}%`;
      query.andWhere(
        `(LOWER(document.title) LIKE :search OR LOWER(COALESCE(document.plainText, '')) LIKE :search)`,
        { search: lowered },
      );
    }

    query.skip((currentPage - 1) * currentLimit);
    query.take(currentLimit);

    const [result, total] = await query.getManyAndCount();
    const lastPage = Math.ceil(total / currentLimit);

    return {
      data: result,
      meta: {
        current_page: currentPage,
        from: total === 0 ? 0 : (currentPage - 1) * currentLimit + 1,
        last_page: lastPage,
        per_page: currentLimit,
        to: (currentPage - 1) * currentLimit + result.length,
        total,
      },
      success: true,
      message: 'Success',
      error: null,
    };
  }

  async findDocumentsData(
    user: any,
    organizationId?: string | null,
  ): Promise<any> {
    const userFound = await this.getUserOrThrow(user);

    const recentquery = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.userId = :userId', { userId: userFound.id })
      .leftJoinAndSelect('document.folder', 'folder')
      .leftJoinAndSelect('document.files', 'files')
      .orderBy('document.updatedAt', 'DESC')
      .limit(5);
    this.applyOrganizationScope(recentquery, 'document', organizationId);

    const filesquery = this.filesRepository
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.document', 'document')
      .where('document.userId = :userId', { userId: userFound.id })
      .orderBy('document.updatedAt', 'DESC')
      .limit(5);
    this.applyOrganizationScope(filesquery, 'file', organizationId);

    const favoritequery = this.documentsRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.folder', 'folder')
      .leftJoinAndSelect('document.files', 'files')
      .where('document.userId = :userId', { userId: userFound.id })
      .andWhere('document.isFavorite = :isFavorite', { isFavorite: true })
      .orderBy('document.updatedAt', 'DESC')
      .limit(5);
    this.applyOrganizationScope(favoritequery, 'document', organizationId);

    const [recentdata, recentfiles, favoritedata] = await Promise.all([
      recentquery.getMany(),
      filesquery.getMany(),
      favoritequery.getMany(),
    ]);

    return {
      data: {
        recent: recentdata,
        files: recentfiles,
        favorites: favoritedata,
      },
      success: true,
      message: 'Success',
      error: null,
    };
  }

  async findRecentUserDocumentFiles(
    user: any,
    organizationId?: string | null,
  ): Promise<any> {
    const userFound = await this.getUserOrThrow(user);

    const query = this.filesRepository
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.document', 'document')
      .where('document.userId = :userId', { userId: userFound.id })
      .orderBy('document.updatedAt', 'DESC')
      .limit(5);
    this.applyOrganizationScope(query, 'file', organizationId);

    const data = await query.getMany();

    return {
      data,
      success: true,
      message: 'Success',
      error: null,
    };
  }

  async findFavoriteUserDocuments(
    user: any,
    organizationId?: string | null,
  ): Promise<any> {
    const userFound = await this.getUserOrThrow(user);

    const query = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.userId = :userId', { userId: userFound.id })
      .leftJoinAndSelect('document.folder', 'folder')
      .leftJoinAndSelect('document.files', 'files')
      .andWhere('document.isFavorite = :isFavorite', { isFavorite: true })
      .orderBy('document.updatedAt', 'DESC')
      .limit(5);
    this.applyOrganizationScope(query, 'document', organizationId);

    const data = await query.getMany();

    return {
      data,
      success: true,
      message: 'Success',
      error: null,
    };
  }

  async findOne(
    id: string,
    user: any,
    organizationId?: string | null,
  ): Promise<any> {
    const userFound = await this.getUserOrThrow(user);
    const document = await this.getOwnedDocumentOrThrow(
      id,
      userFound.id,
      organizationId,
    );

    return {
      data: document,
      success: true,
    };
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    user: any,
    organizationId?: string | null,
  ): Promise<any> {
    const userFound = await this.getUserOrThrow(user);
    const document = await this.getOwnedDocumentOrThrow(
      id,
      userFound.id,
      organizationId,
    );
    const { lastKnownUpdatedAt, ...updatePayload } = updateDocumentDto;

    if (lastKnownUpdatedAt) {
      const clientTimestamp = new Date(lastKnownUpdatedAt);
      if (
        Number.isNaN(clientTimestamp.getTime()) ||
        clientTimestamp.getTime() !== document.updatedAt.getTime()
      ) {
        throw new HttpException(
          {
            message:
              'This document was updated in another session. Reload to review the latest version.',
            data: {
              latestDocument: document,
            },
          },
          HttpStatus.CONFLICT,
        );
      }
    }

    const nextContent = updatePayload.content ?? document.content;
    const plainText =
      updatePayload.plainText ?? this.extractPlainText(nextContent);
    const metadata = this.calculateMetadata(nextContent);

    Object.assign(document, {
      ...updatePayload,
      plainText,
      metadata,
      publishedAt:
        updatePayload.isPublished && !document.publishedAt
          ? new Date()
          : document.publishedAt,
    });

    const savedDocument = await this.documentsRepository.save(document);

    return {
      data: savedDocument,
      success: true,
      message: 'Successfully Updated',
    };
  }

  async remove(
    id: string,
    user: any,
    organizationId?: string | null,
  ): Promise<any> {
    const userFound = await this.getUserOrThrow(user);
    await this.getOwnedDocumentOrThrow(id, userFound.id, organizationId);

    const files = await this.filesRepository
      .createQueryBuilder('file')
      .where('file.documentId = :documentId', { documentId: id })
      .andWhere(
        organizationId === null
          ? 'file.organization_id IS NULL'
          : 'file.organization_id = :organizationId',
        organizationId === null ? {} : { organizationId },
      )
      .getMany();

    for (const file of files) {
      await this.storageService.deleteFile(file.path);
    }

    await this.filesRepository
      .createQueryBuilder()
      .delete()
      .from(DocumentFile)
      .where('documentId = :documentId', { documentId: id })
      .andWhere(
        organizationId === null
          ? 'organization_id IS NULL'
          : 'organization_id = :organizationId',
        organizationId === null ? {} : { organizationId },
      )
      .execute();

    const deleteQuery = this.documentsRepository
      .createQueryBuilder()
      .delete()
      .from(Document)
      .where('id = :id', { id })
      .andWhere('userId = :userId', { userId: userFound.id });

    if (organizationId === null) {
      deleteQuery.andWhere('organization_id IS NULL');
    } else {
      deleteQuery.andWhere('organization_id = :organizationId', {
        organizationId,
      });
    }

    const deleteResult = await deleteQuery.execute();

    if (!deleteResult.affected) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return {
      success: true,
      message: 'Document deleted successfully',
      data: { id },
    };
  }

  async addFiles(
    documentId: string,
    files: Array<Express.Multer.File>,
    user: any,
    organizationId?: string | null,
  ): Promise<DocumentFile[]> {
    const userFound = await this.getUserOrThrow(user);
    await this.getOwnedDocumentOrThrow(documentId, userFound.id, organizationId);

    const uploadedFiles = await Promise.all(
      (files ?? []).map(async (file) => {
        const filePath = this.generateDocumentFilePath(
          documentId,
          organizationId ?? null,
          file.originalname,
        );
        const fileUrl = await this.storageService.uploadFile(
          file as MulterFile,
          filePath,
        );

        return this.filesRepository.create({
          documentId,
          filename: filePath.split('/').pop() || file.originalname,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: filePath,
          url: fileUrl,
          organization_id: organizationId ?? null,
        });
      }),
    );

    return await this.filesRepository.save(uploadedFiles);
  }

  async removeFile(
    fileId: string,
    user: any,
    organizationId?: string | null,
  ): Promise<any> {
    const userFound = await this.getUserOrThrow(user);

    const file = await this.filesRepository.findOne({
      where: { id: fileId },
      relations: ['document'],
    });

    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    if (file.document.userId !== userFound.id) {
      throw new ForbiddenException('You do not have access to this file');
    }

    if ((file.organization_id ?? null) !== (organizationId ?? null)) {
      throw new ForbiddenException('You do not have access to this file');
    }

    await this.storageService.deleteFile(file.path);
    await this.filesRepository.remove(file);
    return {
      success: true,
      message: 'File deleted successfully',
      data: { id: fileId },
    };
  }

  private calculateMetadata(content: string): Document['metadata'] {
    const plainText = this.extractPlainText(content);
    const words = plainText.split(/\s+/).filter((word) => word.length > 0);
    const wordCount = words.length;
    const characterCount = plainText.length;
    const readingTime = Math.ceil(wordCount / 200);

    return {
      wordCount,
      characterCount,
      readingTime,
    };
  }

  async moveToFolder(
    documentId: string,
    folderId: string | null,
    user: any,
    organizationId?: string | null,
  ): Promise<Document> {
    const userFound = await this.getUserOrThrow(user);
    const document = await this.getOwnedDocumentOrThrow(
      documentId,
      userFound.id,
      organizationId,
    );

    let nextFolder: Folder | null = null;

    if (folderId) {
      nextFolder = await this.foldersRepository.findOne({
        where: { id: folderId, userId: userFound.id, organization_id: organizationId ?? null },
      });

      if (!nextFolder) {
        throw new NotFoundException('Folder not found');
      }
    }

    document.folderId = folderId;
    document.folder = nextFolder;

    await this.documentsRepository.save(document);

    return await this.getOwnedDocumentOrThrow(
      documentId,
      userFound.id,
      organizationId,
    );
  }

  async findByFolder(
    folderId: string | null,
    user: any,
    organizationId?: string | null,
  ): Promise<Document[]> {
    const userFound = await this.getUserOrThrow(user);
    const query = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.userId = :userId', { userId: userFound.id })
      .leftJoinAndSelect('document.folder', 'folder')
      .leftJoinAndSelect('document.files', 'files')
      .orderBy('document.updatedAt', 'DESC');
    this.applyOrganizationScope(query, 'document', organizationId);

    if (folderId === null) {
      query.andWhere('document.folderId IS NULL');
    } else {
      query.andWhere('document.folderId = :folderId', { folderId });
    }

    return await query.getMany();
  }

  private async getUserOrThrow(user: any) {
    const userFound = await this.usersService.getUserAccountById(user.userId);
    if (!userFound) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    return userFound;
  }

  private async getOwnedDocumentOrThrow(
    id: string,
    userId: number,
    organizationId?: string | null,
  ): Promise<Document> {
    const query = this.documentsRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.folder', 'folder')
      .leftJoinAndSelect('document.files', 'files')
      .leftJoinAndSelect('document.author', 'author')
      .where('document.id = :id', { id })
      .andWhere('document.userId = :userId', { userId });

    this.applyOrganizationScope(query, 'document', organizationId);

    const document = await query.getOne();

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return document;
  }

  private applyOrganizationScope(
    query: any,
    alias: string,
    organizationId?: string | null,
  ) {
    if (organizationId === undefined) {
      return query;
    }

    if (organizationId === null) {
      query.andWhere(`${alias}.organization_id IS NULL`);
      return query;
    }

    query.andWhere(`${alias}.organization_id = :organizationId`, {
      organizationId,
    });

    return query;
  }

  private extractPlainText(content: string) {
    if (typeof content !== 'string') {
      throw new BadRequestException('Document content must be a string');
    }

    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private generateDocumentFilePath(
    documentId: string,
    organizationId: string | null,
    filename: string,
  ) {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const organizationSegment = organizationId ?? 'personal';

    return `organizations/${organizationSegment}/documents/${documentId}/files/${timestamp}_${sanitizedFilename}`;
  }
}
