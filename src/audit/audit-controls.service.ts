import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Interval } from '@nestjs/schedule';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { AuditExport, AuditExportState } from 'src/typeorm/entities/AuditExport';
import { AuditRetentionPolicy } from 'src/typeorm/entities/AuditRetentionPolicy';
import { AuditPurgeRun } from 'src/typeorm/entities/AuditPurgeRun';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { AuditReaderService } from './audit-reader.service';
import { AUDIT_LIMITS, AuditAction, AuditActorType, AuditOutcome, AuditSource, AuditSubjectType } from './audit-contract';
import { AuditWriterService } from './audit-writer.service';
import { CreateAuditExportDto, UpdateAuditRetentionDto } from './dto/audit-controls.dto';

@Injectable()
export class AuditControlsService {
  private working = false;
  constructor(
    @InjectRepository(AuditExport) private readonly exports: Repository<AuditExport>,
    @InjectRepository(AuditRetentionPolicy) private readonly policies: Repository<AuditRetentionPolicy>,
    @InjectRepository(AuditPurgeRun) private readonly purges: Repository<AuditPurgeRun>,
    @InjectRepository(AuditLog) private readonly audits: Repository<AuditLog>,
    private readonly reader: AuditReaderService,
    private readonly writer: AuditWriterService,
    private readonly dataSource: DataSource,
  ) {}

  private actor(user: any) { return { type: AuditActorType.HUMAN, id: user.userId, label: 'Organization administrator' }; }
  private view(row: AuditExport) { const { artifact: _artifact, ...safe } = row; return safe; }

  async createExport(user: any, organizationId: string, dto: CreateAuditExportDto) {
    await this.reader.assertOrganizationAdmin(user, organizationId);
    const now = new Date(); const expires = new Date(now.getTime() + 24 * 3600000);
    const { format, ...filters } = dto;
    return this.dataSource.transaction(async (manager) => {
      const row = manager.getRepository(AuditExport).create({ organization_id: organizationId, requested_by_user_id: user.userId, format, state: AuditExportState.QUEUED, filters, watermark_at: now, expires_at: expires });
      await manager.getRepository(AuditExport).save(row);
      await this.writer.append(manager, { organizationId, action: AuditAction.AUDIT_EXPORT_CREATED, actor: this.actor(user), subject: { type: AuditSubjectType.AUDIT_EXPORT, id: row.id }, source: AuditSource.API, outcome: AuditOutcome.SUCCEEDED, after: { format, status: row.state }, correlationId: this.writer.correlationId(), sourceEventKey: `audit-export-created:${row.id}` });
      return this.view(row);
    });
  }

  async listExports(user: any, organizationId: string) {
    await this.reader.assertOrganizationAdmin(user, organizationId);
    return (await this.exports.find({ where: { organization_id: organizationId, requested_by_user_id: user.userId }, order: { created_at: 'DESC' }, take: 50 })).map((r) => this.view(r));
  }

  async cancelExport(user: any, organizationId: string, id: string) {
    await this.reader.assertOrganizationAdmin(user, organizationId);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AuditExport); const row = await repo.findOne({ where: { id, organization_id: organizationId, requested_by_user_id: user.userId } });
      if (!row) throw new NotFoundException('Audit export not found');
      if (![AuditExportState.QUEUED, AuditExportState.RUNNING].includes(row.state)) throw new BadRequestException('Audit export cannot be cancelled');
      row.state = AuditExportState.CANCELLED; await repo.save(row);
      await this.writer.append(manager, { organizationId, action: AuditAction.AUDIT_EXPORT_CANCELLED, actor: this.actor(user), subject: { type: AuditSubjectType.AUDIT_EXPORT, id }, source: AuditSource.API, correlationId: this.writer.correlationId(), sourceEventKey: `audit-export-cancelled:${id}` });
      return this.view(row);
    });
  }

  async download(user: any, organizationId: string, id: string) {
    await this.reader.assertOrganizationAdmin(user, organizationId);
    const row = await this.exports.createQueryBuilder('e').addSelect('e.artifact').where('e.id = :id AND e.organization_id = :organizationId AND e.requested_by_user_id = :userId', { id, organizationId, userId: user.userId }).getOne();
    if (!row) throw new NotFoundException('Audit export not found');
    if (row.expires_at <= new Date() || row.state === AuditExportState.EXPIRED) throw new NotFoundException('Audit export not found');
    if (row.state !== AuditExportState.COMPLETED || row.artifact == null) throw new BadRequestException('Audit export is not ready');
    await this.dataSource.transaction((manager) => this.writer.append(manager, { organizationId, action: AuditAction.AUDIT_EXPORT_DOWNLOADED, actor: this.actor(user), subject: { type: AuditSubjectType.AUDIT_EXPORT, id }, source: AuditSource.API, correlationId: this.writer.correlationId(), sourceEventKey: `audit-export-download:${id}:${Date.now()}` }));
    return { filename: `audit-${id}.${row.format}`, contentType: row.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/x-ndjson', content: row.artifact };
  }

  async retention(user: any, organizationId: string) {
    await this.reader.assertOrganizationAdmin(user, organizationId);
    const row = await this.policies.findOne({ where: { organization_id: organizationId } });
    return { retentionDays: row?.retention_days ?? AUDIT_LIMITS.defaultRetentionDays };
  }

  async updateRetention(user: any, organizationId: string, dto: UpdateAuditRetentionDto) {
    await this.reader.assertOrganizationAdmin(user, organizationId);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AuditRetentionPolicy); const before = await repo.findOne({ where: { organization_id: organizationId } });
      await repo.upsert({ organization_id: organizationId, retention_days: dto.retentionDays, updated_by_user_id: user.userId }, ['organization_id']);
      let purge: AuditPurgeRun | null = null;
      if (dto.applyToExisting) { const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - dto.retentionDays); purge = manager.getRepository(AuditPurgeRun).create({ organization_id: organizationId, requested_by_user_id: user.userId, state: 'queued', cutoff_at: cutoff, cursor_id: null, deleted_count: 0, failure_code: null, completed_at: null }); await manager.getRepository(AuditPurgeRun).save(purge); }
      await this.writer.append(manager, { organizationId, action: AuditAction.AUDIT_RETENTION_CHANGED, actor: this.actor(user), subject: { type: AuditSubjectType.AUDIT_RETENTION_POLICY, id: organizationId }, source: AuditSource.API, before: { retention_days: before?.retention_days ?? AUDIT_LIMITS.defaultRetentionDays }, after: { retention_days: dto.retentionDays }, metadata: { purge_scheduled: Boolean(purge) }, correlationId: this.writer.correlationId(), sourceEventKey: `audit-retention:${organizationId}:${Date.now()}` });
      return { retentionDays: dto.retentionDays, purgeId: purge?.id ?? null };
    });
  }

  private neutralize(value: unknown) { const text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value); return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; }
  private csv(value: unknown) { return `"${this.neutralize(value).replace(/"/g, '""')}"`; }
  private async build(row: AuditExport) {
    const filters: any = row.filters || {}; const qb = this.audits.createQueryBuilder('a').where('a.organization_id = :organizationId', { organizationId: row.organization_id }).andWhere('COALESCE(a.occurred_at,a.created_at) <= :watermark', { watermark: row.watermark_at });
    for (const [key, column] of Object.entries({ projectId: 'project_id', action: 'action', actorType: 'actor_type', actorId: 'actor_id', subjectType: 'subject_type', subjectId: 'subject_id', source: 'source', outcome: 'outcome', correlationId: 'correlation_id' })) if (filters[key] !== undefined) qb.andWhere(`a.${column} = :${key}`, { [key]: filters[key] });
    if (filters.from) qb.andWhere('COALESCE(a.occurred_at,a.created_at) >= :from', { from: new Date(filters.from) });
    if (filters.to) qb.andWhere('COALESCE(a.occurred_at,a.created_at) <= :to', { to: new Date(filters.to) });
    qb.andWhere("a.action NOT IN (:...controls)", { controls: [AuditAction.AUDIT_EXPORT_CREATED, AuditAction.AUDIT_EXPORT_COMPLETED, AuditAction.AUDIT_EXPORT_DOWNLOADED, AuditAction.AUDIT_EXPORT_CANCELLED, AuditAction.AUDIT_EXPORT_EXPIRED] });
    const rows = await qb.orderBy('COALESCE(a.occurred_at,a.created_at)', 'ASC').addOrderBy('a.id', 'ASC').take(AUDIT_LIMITS.exportRows).getMany(); const events = rows.map((r) => this.reader.serialize(r));
    if (row.format === 'jsonl') return { artifact: events.map((e) => JSON.stringify(e)).join('\n'), count: events.length };
    const header = ['id','occurredAt','action','outcome','source','projectId','actorType','actorId','subjectType','subjectId','before','after','metadata'];
    return { artifact: [header.join(','), ...events.map((e:any) => [e.id,e.occurredAt,e.action,e.outcome,e.source,e.projectId,e.actor.type,e.actor.id,e.subject.type,e.subject.id,e.before,e.after,e.metadata].map((v) => this.csv(v)).join(','))].join('\r\n'), count: events.length };
  }

  @Interval(5000) async work() {
    if (this.working) return; this.working = true;
    try { await this.expire(); const row = await this.exports.findOne({ where: { state: AuditExportState.QUEUED }, order: { created_at: 'ASC' } }); if (row) { const claim = await this.exports.update({ id: row.id, state: AuditExportState.QUEUED }, { state: AuditExportState.RUNNING }); if (claim.affected) { try { const built = await this.build(row); await this.dataSource.transaction(async (manager) => { await manager.getRepository(AuditExport).update({ id: row.id, state: AuditExportState.RUNNING }, { row_count: built.count, artifact: built.artifact, state: AuditExportState.COMPLETED, completed_at: new Date() }); await this.writer.append(manager, { organizationId: row.organization_id, action: AuditAction.AUDIT_EXPORT_COMPLETED, actor: { type: AuditActorType.SYSTEM, id: 'audit-export-worker', label: 'Audit export worker' }, subject: { type: AuditSubjectType.AUDIT_EXPORT, id: row.id }, source: AuditSource.SCHEDULER, after: { status: 'completed', row_count: built.count, format: row.format }, correlationId: row.id, sourceEventKey: `audit-export-completed:${row.id}` }); }); } catch { await this.exports.update(row.id, { state: AuditExportState.FAILED, failure_code: 'EXPORT_FAILED' }); } } } await this.purgeChunk(); } finally { this.working = false; }
  }

  private async expire() {
    const rows = await this.exports.find({ where: { expires_at: LessThanOrEqual(new Date()), state: AuditExportState.COMPLETED }, order: { expires_at: 'ASC' }, take: 100 });
    for (const row of rows) await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(AuditExport).update({ id: row.id, state: AuditExportState.COMPLETED }, { state: AuditExportState.EXPIRED, artifact: null });
      if (!result.affected) return;
      await this.writer.append(manager, { organizationId: row.organization_id, action: AuditAction.AUDIT_EXPORT_EXPIRED, actor: { type: AuditActorType.SYSTEM, id: 'audit-export-worker', label: 'Audit export worker' }, subject: { type: AuditSubjectType.AUDIT_EXPORT, id: row.id }, source: AuditSource.SCHEDULER, after: { status: 'expired' }, correlationId: row.id, sourceEventKey: `audit-export-expired:${row.id}` });
    });
  }
  private async purgeChunk() { const run = await this.purges.findOne({ where: { state: 'queued' }, order: { created_at: 'ASC' } }); if (!run) return; const claim = await this.purges.update({ id: run.id, state: 'queued' }, { state: 'running' }); if (!claim.affected) return; await this.dataSource.transaction(async (manager) => { await manager.query('SET @tailpoint_audit_retention_worker = 1'); try { const ids: Array<{id:string}> = await manager.query('SELECT id FROM audit_logs WHERE organization_id = ? AND retention_expires_at <= ? AND occurred_at <= ? ORDER BY id LIMIT 500', [run.organization_id, new Date(), run.cutoff_at]); if (ids.length) await manager.query(`DELETE FROM audit_logs WHERE id IN (${ids.map(() => '?').join(',')})`, ids.map((x) => x.id)); const done = ids.length < 500; await manager.getRepository(AuditPurgeRun).update(run.id, { deleted_count: run.deleted_count + ids.length, cursor_id: ids.at(-1)?.id ?? run.cursor_id, state: done ? 'completed' : 'queued', completed_at: done ? new Date() : null }); } finally { await manager.query('SET @tailpoint_audit_retention_worker = 0'); } }); }
}
