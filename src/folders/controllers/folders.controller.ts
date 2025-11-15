import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FoldersService } from '../services/folders.service';
import { ApiOperation } from '@nestjs/swagger';
import { CreateFolderDto } from '../dtos/create-folder.dto';
import { UpdateFolderDto } from '../dtos/update-folder.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  create(@Body() createFolderDto: CreateFolderDto, @Req() req) {
    return this.foldersService.create(createFolderDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all folders (flat list or tree structure)' })
  findAll(@Req() req, @Query('tree') tree?: string) {
    console.log(tree, 'tree');
    if (tree === 'true') {
      return this.foldersService.findAllWithTree(req.user);
    }
    return this.foldersService.findAll(req.user);
  }

  @Get('/recent')
  @ApiOperation({ summary: 'Get all recent folders' })
  findRecentFolders(@Req() req) {
    console.log('heree');
    return this.foldersService.findRecentFolders(req.user);
  }

  @Get(':id')
  async getFolderById(@Request() req, @Param('id') folderId: string) {
    return this.foldersService.findFolderById(req.user, folderId);
  }

  @Patch(':id/move')
  async moveFolder(
    @Request() req,
    @Param('id') folderId: string,
    @Body() body: { parentId: string },
  ) {
    return this.foldersService.moveFolder(req.user, folderId, body.parentId);
  }

  // @Get(':id')
  // @ApiOperation({ summary: 'Get a folder by ID with its contents' })
  // findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
  //   return this.foldersService.findOneWithContents(id, req.user);
  // }

  @Get(':id/breadcrumbs')
  @ApiOperation({ summary: 'Get folder breadcrumbs (path from root)' })
  getBreadcrumbs(@Param('id') id: string, @Req() req) {
    return this.foldersService.getBreadcrumbs(id, req.user);
  }

  @Get(':id/descendants')
  @ApiOperation({ summary: 'Get all descendant folders' })
  getDescendants(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return this.foldersService.getDescendants(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a folder' })
  update(
    @Param('id') id: string,
    @Body() updateFolderDto: UpdateFolderDto,
    @Req() req,
  ) {
    console.log('wewee');
    return this.foldersService.update(id, updateFolderDto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a folder' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return this.foldersService.remove(id, req.user);
  }
}
