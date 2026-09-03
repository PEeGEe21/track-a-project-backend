import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from 'src/common/guards/super-admin.guard';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { AuditWriterService } from './audit-writer.service';
import { AuditReaderService } from './audit-reader.service';
import { AuditAction, AuditActorType, AuditSource, AuditSubjectType } from './audit-contract';
import { BreakGlassDto } from './dto/audit-controls.dto';

@Controller('admin/audit-review')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AuditSupportController {
  constructor(@InjectRepository(AuditLog) private readonly audits: Repository<AuditLog>, private readonly reader: AuditReaderService, private readonly writer: AuditWriterService, private readonly dataSource: DataSource) {}
  @Get()
  async list(@Query('organizationId') organizationId: string, @Query('limit') rawLimit?: string) {
    if (!organizationId) throw new NotFoundException('Audit event not found'); const limit = Math.min(Math.max(Number(rawLimit) || 50, 1), 100);
    const rows = await this.audits.find({ where: { organization_id: organizationId }, order: { occurred_at: 'DESC', id: 'DESC' }, take: limit });
    return rows.map((row) => { const event: any = this.reader.serialize(row); delete event.before; delete event.after; return event; });
  }
  @Post(':id/break-glass')
  async detail(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') organizationId: string, @Body(ValidationPipe) dto: BreakGlassDto) {
    const row = await this.audits.findOne({ where: { id, organization_id: organizationId } }); if (!row) throw new NotFoundException('Audit event not found');
    await this.dataSource.transaction((manager) => this.writer.append(manager, { organizationId, action: AuditAction.AUDIT_BREAK_GLASS_ACCESSED, actor: { type: AuditActorType.ADMIN, id: req.user.userId, label: 'Platform support administrator' }, subject: { type: AuditSubjectType.ORGANIZATION, id: organizationId }, source: AuditSource.ADMIN, metadata: { accessed_event_id: id, reason: dto.reason }, correlationId: this.writer.correlationId(), sourceEventKey: `break-glass:${id}:${Date.now()}` }));
    return this.reader.serialize(row);
  }
}
