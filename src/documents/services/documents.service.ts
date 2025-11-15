import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { Document } from 'src/typeorm/entities/Document';
import { DocumentFile } from 'src/typeorm/entities/DocumentFile';
import { Folder } from 'src/typeorm/entities/Folder';
import { UsersService } from 'src/users/services/users.service';

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
  ) {}

  async create(
    createDocumentDto: CreateDocumentDto,
    user: any,
  ): Promise<Document> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const metadata = this.calculateMetadata(createDocumentDto.content);

      const document = this.documentsRepository.create({
        ...createDocumentDto,
        author: userFound,
        userId: userFound.id,
        metadata,
        publishedAt: createDocumentDto.isPublished ? new Date() : null,
      });

      return await this.documentsRepository.save(document);
    } catch (err) {}
  }

  async findAll(
    user: any,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;

      const query = this.documentsRepository
        .createQueryBuilder('document')
        .where('document.userId = :userId', { userId })
        .leftJoinAndSelect('document.files', 'files')
        .orderBy('document.updatedAt', 'DESC');

      // if (options?.isPublished !== undefined) {
      //   query.andWhere('document.isPublished = :isPublished', {
      //     isPublished: options.isPublished,
      //   });
      // }

      if (search) {
        const lowered = `%${search.toLowerCase()}%`;
        query.andWhere(
          `(LOWER(document.title) LIKE :search OR LOWER(document.plainText) LIKE :search)`,
          { search: lowered },
        );
      }

      query.skip((page - 1) * limit);
      query.take(limit);

      // const data = await query.getMany();

      const [result, total] = await query.getManyAndCount();
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
        success: true,
        message: 'Success',
        error: null,
      };
    } catch (err) {}
  }

  async findDocumentsData(user: any): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;

      // recent
      const recentquery = this.documentsRepository
        .createQueryBuilder('document')
        .where('document.userId = :userId', { userId })
        .leftJoinAndSelect('document.files', 'files')
        .orderBy('document.updatedAt', 'DESC')
        .limit(5);

      const recentdata = await recentquery.getMany();

      // recent files
      const filesquery = this.filesRepository
        .createQueryBuilder('file')
        .leftJoinAndSelect('file.document', 'document')
        .where('document.userId = :userId', { userId })
        .orderBy('document.updatedAt', 'DESC')
        .limit(5);

      const recentfiles = await filesquery.getMany();

      const favoritequery = this.documentsRepository
        .createQueryBuilder('document')
        .leftJoinAndSelect('document.files', 'files')
        .where('document.userId = :userId', { userId })
        .andWhere('document.isFavorite = :isFavorite', { isFavorite: true })
        .orderBy('document.updatedAt', 'DESC')
        .limit(5);

      const favoritedata = await favoritequery.getMany();

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
    } catch (err) {}
  }

  async findRecentUserDocumentFiles(user: any): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;

      const query = this.filesRepository
        .createQueryBuilder('file')
        .leftJoinAndSelect('file.document', 'document')
        .where('document.userId = :userId', { userId })
        .orderBy('document.updatedAt', 'DESC')
        .limit(5);

      const data = await query.getMany();

      return {
        data,
        success: true,
        message: 'Success',
        error: null,
      };
    } catch (err) {}
  }

  async findFavoriteUserDocuments(user: any): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      if (!userFound) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }

      const userId = userFound.id;

      const query = this.documentsRepository
        .createQueryBuilder('document')
        .where('document.userId = :userId', { userId })
        .leftJoinAndSelect('document.files', 'files')
        .orderBy('document.updatedAt', 'DESC')
        .where('document.isFavorite = :isFavorite', { isFavorite: true })
        .limit(5);

      const data = await query.getMany();

      return {
        data,
        success: true,
        message: 'Success',
        error: null,
      };
    } catch (err) {}
  }

  async findOne(id: string, user: any): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);

      const document = await this.documentsRepository.findOne({
        where: { id },
        relations: ['files', 'author'],
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${id} not found`);
      }

      if (document.userId !== userFound.id) {
        throw new ForbiddenException('You do not have access to this document');
      }

      return {
        data: document,
        success: true,
      };
    } catch (err) {}
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    user: any,
  ): Promise<any> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);

      const document = await this.findOne(id, userFound.id);

      const metadata = updateDocumentDto.content
        ? this.calculateMetadata(updateDocumentDto.content)
        : document.metadata;

      Object.assign(document, {
        ...updateDocumentDto,
        metadata,
        publishedAt:
          updateDocumentDto.isPublished && !document.publishedAt
            ? new Date()
            : document.publishedAt,
      });

      const savedDocument = await this.documentsRepository.save(document);

      return {
        data: savedDocument,
        success: true,
        message: 'Successfully Updated',
      };
    } catch (err) {}
  }

  async remove(id: string, user: any): Promise<void> {
    try {
      const userFound = await this.usersService.getUserAccountById(user.userId);
      const document = await this.findOne(id, userFound.id);
      await this.documentsRepository.remove(document);
    } catch (err) {}
  }

  async addFiles(
    documentId: string,
    files: Array<Express.Multer.File>,
    user: any,
  ): Promise<DocumentFile[]> {
    const userFound = await this.usersService.getUserAccountById(user.userId);

    await this.findOne(documentId, userFound.id);

    const documentFiles = files.map((file) =>
      this.filesRepository.create({
        documentId,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        url: `/uploads/${file.filename}`, // Adjust based on your storage
      }),
    );

    return await this.filesRepository.save(documentFiles);
  }

  async removeFile(fileId: string, user: any): Promise<void> {
    const userFound = await this.usersService.getUserAccountById(user.userId);

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

    await this.filesRepository.remove(file);
    // TODO: Delete physical file from storage
  }

  private calculateMetadata(content: string): Document['metadata'] {
    // Strip HTML tags for word count
    const plainText = content.replace(/<[^>]*>/g, ' ').trim();
    const words = plainText.split(/\s+/).filter((word) => word.length > 0);
    const wordCount = words.length;
    const characterCount = plainText.length;
    const readingTime = Math.ceil(wordCount / 200); // Average reading speed

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
  ): Promise<Document> {
    const userFound = await this.usersService.getUserAccountById(user.userId);
    const document = await this.findOne(documentId, userFound.id);

    // If moving to a folder, verify it exists and belongs to user
    if (folderId) {
      const folder = await this.foldersRepository.findOne({
        where: { id: folderId },
      });

      if (!folder) {
        throw new NotFoundException('Folder not found');
      }

      if (folder.userId !== userFound.id) {
        throw new ForbiddenException('You do not have access to this folder');
      }
    }

    document.folderId = folderId;
    return await this.documentsRepository.save(document);
  }

  async findByFolder(folderId: string | null, user: any): Promise<Document[]> {
    const userFound = await this.usersService.getUserAccountById(user.userId);
    const userId = userFound.id;
    const query = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.userId = :userId', { userId })
      .leftJoinAndSelect('document.files', 'files')
      .orderBy('document.updatedAt', 'DESC');

    if (folderId === null) {
      query.andWhere('document.folderId IS NULL');
    } else {
      query.andWhere('document.folderId = :folderId', { folderId });
    }

    return await query.getMany();
  }
}
