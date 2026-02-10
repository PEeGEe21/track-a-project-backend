import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  ParseIntPipe,
  Req,
  Request,
  Res,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResourcesService } from '../services/resources.service';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { UpdateResourceDto } from '../dto/update-resource.dto';
import { UploadFileDto } from '../dto/upload-file.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MulterFile } from '../../types/multer.types';
import { SimplePreviewService } from '../../services/simple-preview.service';
import { Response } from 'express';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SubscriptionGuard } from 'src/common/guards/subscription.guard';

@UseGuards(JwtAuthGuard)
@UseGuards(OrganizationAccessGuard, SubscriptionGuard)
@Controller('resources')
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly previewService: SimplePreviewService,
  ) {}

  @Post()
  create(
    @Headers('x-organization-id') organizationId: string,
    @Body() createResourceDto: CreateResourceDto,
    @Req() req: any,
  ) {
    return this.resourcesService.create(
      createResourceDto,
      req.user,
      organizationId,
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Headers('x-organization-id') organizationId: string,
    @Body() uploadFileDto: UploadFileDto,
    @Req() req: any,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.resourcesService.uploadFile(file, uploadFileDto, req.user, organizationId);
  }

  // @Get()
  // findAll(
  //   @Query('projectId', ParseIntPipe) projectId?: number,
  //   @Query('taskId', ParseIntPipe) taskId?: number,
  // ) {
  //   return this.resourcesService.findAll(projectId, taskId);
  // }

  @Get()
  findAllResources(
    @Headers('x-organization-id') organizationId: string,
    @Req() req: any,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('search') search: string,
    @Query('projectId') projectId?: any,
    @Query('taskId') taskId?: any,
    @Query('created_by') created_by?: string,
    @Query('type') type?: string,
  ) {
    return this.resourcesService.findAllResources(
      organizationId,
      req.user,
      page,
      limit,
      search,
      projectId,
      taskId,
      created_by,
      type,
    );
  }

  @Get(':id/download')
  async downloadFile(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Request() req,
  ) {
    return await this.resourcesService.downloadFile(+id, req.user, res);
  }

  @Get(':id/preview')
  async getFileUrl(@Param('id') id: string, @Request() req) {
    return await this.resourcesService.getFileUrl(+id, req.user);
  }

  @Get('project/:projectId')
  findByProject(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.resourcesService.findByProject(projectId);
  }

  @Get('task/:taskId')
  findByTask(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.resourcesService.findByTask(taskId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.resourcesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateResourceDto: UpdateResourceDto,
    @Req() req: any,
  ) {
    return this.resourcesService.update(id, updateResourceDto, req.user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.resourcesService.remove(id, req.user);
  }

  @Post('preview')
  generatePreview(@Body('url') url: string) {
    if (!url) {
      throw new Error('URL is required');
    }
    return this.previewService.generatePreview(url);
  }
}
