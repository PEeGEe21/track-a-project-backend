import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { ReorderSidebarProjectsDto } from './dto/reorder-sidebar-projects.dto';
import { SidebarProjectsService } from './sidebar-projects.service';
import { SidebarProjectMutationRateLimitGuard } from './sidebar-project-mutation-rate-limit.guard';

@Controller('users/me/sidebar-projects')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class SidebarProjectsController {
  constructor(private readonly sidebarProjects: SidebarProjectsService) {}

  @Get()
  list(@Req() req: any, @Headers('x-organization-id') organizationId: string) {
    return this.sidebarProjects.list(req.user, organizationId);
  }

  @Put(':projectId')
  @UseGuards(SidebarProjectMutationRateLimitGuard)
  async pin(
    @Req() req: any,
    @Res() response: Response,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    const result = await this.sidebarProjects.pin(
      req.user,
      organizationId,
      projectId,
    );
    return response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK).json(result);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SidebarProjectMutationRateLimitGuard)
  unpin(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.sidebarProjects.unpin(req.user, organizationId, projectId);
  }

  @Patch('order')
  @UseGuards(SidebarProjectMutationRateLimitGuard)
  reorder(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: ReorderSidebarProjectsDto,
  ) {
    return this.sidebarProjects.reorder(req.user, organizationId, dto.projectIds);
  }
}
