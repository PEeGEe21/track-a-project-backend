import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OrganizationAccessGuard } from 'src/common/guards/organization_access.guard';
import { AuditReaderService } from './audit-reader.service';
import { ListAuditEventsDto } from './dto/list-audit-events.dto';
import { AuditControlsService } from './audit-controls.service';
import { CreateAuditExportDto, UpdateAuditRetentionDto } from './dto/audit-controls.dto';
import type { Response } from 'express';

@Controller('audit-events')
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class AuditController {
  constructor(private readonly reader: AuditReaderService, private readonly controls: AuditControlsService) {}

  @Post('exports') createExport(@Req() req: any, @Headers('x-organization-id') organizationId: string, @Body(ValidationPipe) dto: CreateAuditExportDto) { return this.controls.createExport(req.user, organizationId, dto); }
  @Get('exports/list') exports(@Req() req: any, @Headers('x-organization-id') organizationId: string) { return this.controls.listExports(req.user, organizationId); }
  @Patch('exports/:id/cancel') cancel(@Req() req: any, @Headers('x-organization-id') organizationId: string, @Param('id', ParseUUIDPipe) id: string) { return this.controls.cancelExport(req.user, organizationId, id); }
  @Get('exports/:id/download') async download(@Req() req: any, @Res() response: Response, @Headers('x-organization-id') organizationId: string, @Param('id', ParseUUIDPipe) id: string) { const file = await this.controls.download(req.user, organizationId, id); response.setHeader('Content-Type', file.contentType); response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`); response.send(file.content); }
  @Get('retention') retention(@Req() req: any, @Headers('x-organization-id') organizationId: string) { return this.controls.retention(req.user, organizationId); }
  @Patch('retention') updateRetention(@Req() req: any, @Headers('x-organization-id') organizationId: string, @Body(ValidationPipe) dto: UpdateAuditRetentionDto) { return this.controls.updateRetention(req.user, organizationId, dto); }

  @Get()
  list(@Req() req: any, @Headers('x-organization-id') organizationId: string, @Query() query: ListAuditEventsDto) {
    return this.reader.list(req.user, organizationId, query);
  }

  @Get(':id')
  detail(
    @Req() req: any,
    @Headers('x-organization-id') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.reader.detail(req.user, organizationId, id, projectId ? Number(projectId) : undefined);
  }
}
