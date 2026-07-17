import { Body, Controller, Delete, Get, Headers, Param, ParseBoolPipe, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { RequireCapability } from 'src/entitlements/decorators/require-capability.decorator';
import { CapabilityGuard } from 'src/entitlements/guards/capability.guard';
import { SaveProjectUpdateDto } from './dto/project-update.dto';
import { ProjectUpdatesService } from './project-updates.service';

@Controller('projects/:projectId/updates')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard, CapabilityGuard)
@RequireCapability(CapabilityKey.STRUCTURED_PROJECT_UPDATES)
export class ProjectUpdatesController {
  constructor(private readonly service: ProjectUpdatesService) {}
  @Get() list(@Req() req: any, @Headers('x-organization-id') org: string, @Param('projectId', ParseIntPipe) projectId: number, @Query('includeDrafts', new ParseBoolPipe({ optional: true })) includeDrafts?: boolean, @Query('page') page?: number, @Query('limit') limit?: number, @Query('status') status?: 'all' | 'draft' | 'published', @Query('health') health?: string, @Query('mine', new ParseBoolPipe({ optional: true })) mine?: boolean) { return this.service.list(req.user, org, projectId, includeDrafts, page, limit, { status, health, mine }); }
  @Get('reference-options') referenceOptions(@Req() req: any, @Headers('x-organization-id') org: string, @Param('projectId', ParseIntPipe) projectId: number, @Query('type') type?: 'task' | 'document' | 'user', @Query('search') search?: string, @Query('page') page?: number, @Query('limit') limit?: number) { return this.service.referenceOptions(req.user, org, projectId, type, search, page, limit); }
  @Get(':updateId') get(@Req() req: any, @Headers('x-organization-id') org: string, @Param('projectId', ParseIntPipe) projectId: number, @Param('updateId', ParseIntPipe) id: number) { return this.service.get(req.user, org, projectId, id); }
  @Get(':updateId/history') history(@Req() req: any, @Headers('x-organization-id') org: string, @Param('projectId', ParseIntPipe) projectId: number, @Param('updateId', ParseIntPipe) id: number, @Query('page') page?: number, @Query('limit') limit?: number) { return this.service.history(req.user, org, projectId, id, page, limit); }
  @Post() create(@Req() req: any, @Headers('x-organization-id') org: string, @Param('projectId', ParseIntPipe) projectId: number, @Body() dto: SaveProjectUpdateDto) { return this.service.createDraft(req.user, org, projectId, dto); }
  @Patch(':updateId') update(@Req() req: any, @Headers('x-organization-id') org: string, @Param('projectId', ParseIntPipe) projectId: number, @Param('updateId', ParseIntPipe) id: number, @Body() dto: SaveProjectUpdateDto) { return this.service.updateDraft(req.user, org, projectId, id, dto); }
  @Delete(':updateId') deleteDraft(@Req() req: any, @Headers('x-organization-id') org: string, @Param('projectId', ParseIntPipe) projectId: number, @Param('updateId', ParseIntPipe) id: number) { return this.service.deleteDraft(req.user, org, projectId, id); }
  @Post(':updateId/publish') publish(@Req() req: any, @Headers('x-organization-id') org: string, @Param('projectId', ParseIntPipe) projectId: number, @Param('updateId', ParseIntPipe) id: number) { return this.service.publish(req.user, org, projectId, id); }
  @Post(':updateId/corrections') correct(@Req() req: any, @Headers('x-organization-id') org: string, @Param('projectId', ParseIntPipe) projectId: number, @Param('updateId', ParseIntPipe) id: number, @Body() dto: SaveProjectUpdateDto) { return this.service.correct(req.user, org, projectId, id, dto); }
}
