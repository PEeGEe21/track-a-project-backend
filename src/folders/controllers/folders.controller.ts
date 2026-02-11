import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SubscriptionGuard } from 'src/common/guards/subscription.guard';

@Controller('folders')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, RolesGuard, SubscriptionGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  create(
    @Body() createFolderDto: CreateFolderDto,
    @Req() req,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.foldersService.create(
      createFolderDto,
      req.user,
      organizationId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all folders (flat list or tree structure)' })
  findAll(
    @Req() req,
    @Headers('x-organization-id') organizationId: string,
    @Query('tree') tree?: string,
    @Query('group') group?: string,
  ) {
    console.log(tree, 'tree');
    if (tree === 'true') {
      return this.foldersService.findAllWithTree(req.user, organizationId, group);
    }
    return this.foldersService.findAll(req.user, organizationId, group);
  }

  @Get('/recent')
  @ApiOperation({ summary: 'Get all recent folders' })
  findRecentFolders(
    @Req() req,
    @Headers('x-organization-id') organizationId: string,
  ) {
    console.log('heree');
    return this.foldersService.findRecentFolders(req.user, organizationId);
  }

  @Get(':id')
  async getFolderById(
    @Request() req,
    @Param('id') folderId: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.foldersService.findFolderById(
      req.user,
      folderId,
      organizationId,
    );
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
  getBreadcrumbs(
    @Param('id') id: string,
    @Req() req,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.foldersService.getBreadcrumbs(id, req.user, organizationId);
  }

  @Get(':id/descendants')
  @ApiOperation({ summary: 'Get all descendant folders' })
  getDescendants(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.foldersService.getDescendants(id, req.user, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a folder' })
  update(
    @Param('id') id: string,
    @Body() updateFolderDto: UpdateFolderDto,
    @Req() req,
    @Headers('x-organization-id') organizationId: string,
  ) {
    console.log('wewee');
    return this.foldersService.update(id, updateFolderDto, req.user, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a folder' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.foldersService.remove(id, req.user, organizationId);
  }
}
