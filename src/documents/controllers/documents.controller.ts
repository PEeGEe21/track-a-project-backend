import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  ParseUUIDPipe,
  UploadedFiles,
  UseInterceptors,
  Headers,
} from '@nestjs/common';
import { DocumentsService } from '../services/documents.service';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MoveDocumentDto } from '../dto/move-document.dto';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new document' })
  create(
    @Body() createDocumentDto: CreateDocumentDto,
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.create(
      createDocumentDto,
      req.user,
      organizationId ?? null,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all documents for current user' })
  findAll(
    @Req() req,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.findAll(
      req.user,
      page,
      limit,
      search,
      organizationId ?? null,
    );
  }

  @Get('/index')
  @ApiOperation({ summary: 'Get all documents index data for current user' })
  findDocumentsData(
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.findDocumentsData(
      req.user,
      organizationId ?? null,
    );
  }

  @Get('/recent-files')
  @ApiOperation({ summary: 'Get all recent document files for current user' })
  findRecentUserDocumentFiles(
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.findRecentUserDocumentFiles(
      req.user,
      organizationId ?? null,
    );
  }

  @Get('/favorite')
  @ApiOperation({ summary: 'Get favorite documents for current user' })
  findFavoriteUserDocuments(
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.findFavoriteUserDocuments(
      req.user,
      organizationId ?? null,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.findOne(id, req.user, organizationId ?? null);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a document' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.update(
      id,
      updateDocumentDto,
      req.user,
      organizationId ?? null,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.remove(id, req.user, organizationId ?? null);
  }

  @Post(':id/files')
  @ApiOperation({ summary: 'Upload files to a document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  uploadFiles(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.addFiles(
      id,
      files,
      req.user,
      organizationId ?? null,
    );
  }

  @Delete('files/:fileId')
  @ApiOperation({ summary: 'Delete a file' })
  removeFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.removeFile(
      fileId,
      req.user,
      organizationId ?? null,
    );
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move document to a folder' })
  moveToFolder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() moveDocumentDto: MoveDocumentDto,
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    return this.documentsService.moveToFolder(
      id,
      moveDocumentDto.folderId,
      req.user,
      organizationId ?? null,
    );
  }

  @Get('folder/:folderId')
  @ApiOperation({ summary: 'Get all documents in a folder' })
  findByFolder(
    @Param('folderId') folderId: string,
    @Req() req,
    @Headers('x-organization-id') organizationId?: string,
  ) {
    const folderIdOrNull = folderId === 'root' ? null : folderId;
    return this.documentsService.findByFolder(
      folderIdOrNull,
      req.user,
      organizationId ?? null,
    );
  }
}
