import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import {
  ConvertWhiteboardDto,
  CreateWorkflowTemplateDto,
  InstantiateWorkflowDto,
  UpdateWorkflowTemplateDto,
} from './dto/workflow.dto';
import { WorkflowsService } from './workflows.service';

@Controller()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}
  @Get('workflow-templates')
  list(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.workflows.list(
      req.user,
      org,
      projectId ? Number(projectId) : undefined,
    );
  }
  @Patch('workflow-templates/:templateId')
  update(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateWorkflowTemplateDto,
  ) {
    return this.workflows.updateTemplate(req.user, org, templateId, dto);
  }
  @Delete('workflow-templates/:templateId')
  remove(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('templateId') templateId: string,
  ) {
    return this.workflows.deleteTemplate(req.user, org, templateId);
  }
  @Post('workflow-templates/:templateId/diagram')
  saveDiagram(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('templateId') templateId: string,
    @Body() dto: any,
  ) {
    return this.workflows.saveDiagram(req.user, org, templateId, dto);
  }
  @Patch('workflow-templates/:templateId/diagram/title')
  refreshDiagramTitle(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('templateId') templateId: string,
  ) {
    return this.workflows.refreshDiagramTitle(req.user, org, templateId);
  }
  @Post('workflow-templates/:templateId/sync')
  sync(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('templateId') templateId: string,
  ) {
    return this.workflows.syncFromSourceProject(req.user, org, templateId);
  }
  @Post('projects/:projectId/whiteboards/:boardId/convert') convert(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('boardId') boardId: string,
    @Body() dto: ConvertWhiteboardDto,
  ) {
    return this.workflows.convertWhiteboard(
      req.user,
      org,
      projectId,
      boardId,
      dto,
    );
  }
  @Post('projects/:projectId/workflow-templates') create(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateWorkflowTemplateDto,
  ) {
    return this.workflows.createTemplate(req.user, org, projectId, dto);
  }
  @Get('workflow-templates/:templateId/preview') preview(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('templateId') templateId: string,
    @Query('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.workflows.preview(req.user, org, templateId, projectId);
  }
  @Post('workflow-templates/:templateId/instantiate') instantiate(
    @Req() req: any,
    @Headers('x-organization-id') org: string,
    @Param('templateId') templateId: string,
    @Body() dto: InstantiateWorkflowDto,
  ) {
    return this.workflows.instantiate(req.user, org, templateId, dto);
  }
}
