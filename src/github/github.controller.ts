import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import {
  CreateGithubConnectionDto,
  RotateGithubSecretDto,
  UpdateGithubConnectionDto,
  LinkGithubArtifactDto,
  MoveGithubArtifactDto,
  GithubActivityQueryDto,
} from './dto/github-integration.dto';
import { GithubService } from './github.service';

@Controller('github')
export class GithubController {
  constructor(private readonly service: GithubService) {}
  @Get('connections/project/:projectId')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  list(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.service.list(req.user, org, projectId);
  }
  @Post('connections')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  create(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Body() dto: CreateGithubConnectionDto,
  ) {
    return this.service.create(req.user, org, dto);
  }
  @Get('connections/:id')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  detail(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(req.user, org, id);
  }
  @Patch('connections/:id')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  update(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGithubConnectionDto,
  ) {
    return this.service.update(req.user, org, id, dto);
  }
  @Post('connections/:id/rotate-secret')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  rotate(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RotateGithubSecretDto,
  ) {
    return this.service.rotate(req.user, org, id, dto);
  }
  @Get('connections/:id/deliveries')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  deliveries(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.connectionDeliveries(req.user, org, id);
  }
  @Delete('connections/:id')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  archive(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(req.user, org, id);
  }
  @Get('tasks/:taskId/links')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  links(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.service.taskLinks(req.user, org, taskId);
  }
  @Get('projects/:projectId/link-diagnostics')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  diagnostics(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.service.linkDiagnostics(req.user, org, projectId);
  }
  @Get('projects/:projectId/activity')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  activity(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: GithubActivityQueryDto,
  ) {
    return this.service.projectActivity(req.user, org, projectId, query);
  }
  @Delete('tasks/:taskId/links/:artifactId')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  unlink(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('artifactId', ParseUUIDPipe) artifactId: string,
  ) {
    return this.service.unlinkTaskArtifact(req.user, org, taskId, artifactId);
  }
  @Post('tasks/:taskId/links')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  link(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: LinkGithubArtifactDto,
  ) {
    return this.service.linkTaskArtifact(
      req.user,
      org,
      taskId,
      dto.artifactUrl,
    );
  }
  @Patch('tasks/:taskId/links/:artifactId/move')
  @UseGuards(JwtAuthGuard, OrganizationAccessGuard)
  move(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('artifactId', ParseUUIDPipe) artifactId: string,
    @Body() dto: MoveGithubArtifactDto,
  ) {
    return this.service.moveTaskArtifact(
      req.user,
      org,
      taskId,
      artifactId,
      dto.targetTaskId,
    );
  }
  @Post('webhooks/:key')
  @HttpCode(202)
  webhook(
    @Param('key') key: string,
    @Headers() headers: Record<string, string>,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.service.receive(key, headers, body, req.rawBody, req.ip);
  }
}
