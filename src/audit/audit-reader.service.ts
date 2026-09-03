import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { OrganizationRole } from 'src/utils/constants/org_roles';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';
import { EntitlementsService } from 'src/entitlements/entitlements.service';
import { CapabilityKey } from 'src/entitlements/capability-catalog';
import { ListAuditEventsDto } from './dto/list-audit-events.dto';
import { AuditPayloadSanitizer } from './audit-payload-sanitizer';

type AuditScope = { organizationAdmin: boolean; projectIds: number[] };

@Injectable()
export class AuditReaderService {
  constructor(
    @InjectRepository(AuditLog) private readonly audits: Repository<AuditLog>,
    @InjectRepository(UserOrganization) private readonly memberships: Repository<UserOrganization>,
    @InjectRepository(ProjectPeer) private readonly projectPeers: Repository<ProjectPeer>,
    private readonly entitlements: EntitlementsService,
    private readonly sanitizer: AuditPayloadSanitizer,
  ) {}

  private async scope(user: any, organizationId: string, requestedProjectId?: number): Promise<AuditScope> {
    await this.entitlements.assertCapability(user, organizationId, CapabilityKey.ADVANCED_AUDIT_TRAIL);
    const membership = await this.memberships.findOne({
      where: { organization_id: organizationId, user_id: user.userId, is_active: true },
    });
    if (!membership) throw new NotFoundException('Audit event not found');
    if (membership.role === OrganizationRole.ORG_ADMIN) {
      return { organizationAdmin: true, projectIds: requestedProjectId ? [requestedProjectId] : [] };
    }
    if (!requestedProjectId) throw new NotFoundException('Audit event not found');
    const ownership = await this.projectPeers.findOne({
      where: {
        organization_id: organizationId,
        user: { id: user.userId },
        project: { id: requestedProjectId },
        role: ProjectRole.OWNER,
        status: ProjectPeerStatus.CONNECTED,
        is_confirmed: true,
      },
      relations: ['user', 'project'],
    });
    if (!ownership) throw new NotFoundException('Audit event not found');
    return { organizationAdmin: false, projectIds: [requestedProjectId] };
  }

  async assertOrganizationAdmin(user: any, organizationId: string): Promise<void> {
    const scope = await this.scope(user, organizationId);
    if (!scope.organizationAdmin) throw new NotFoundException('Audit event not found');
  }

  private dates(filters: ListAuditEventsDto) {
    const to = filters.to ? new Date(filters.to) : new Date();
    if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
      to.setUTCHours(23, 59, 59, 999);
    }
    const from = filters.from ? new Date(filters.from) : new Date(to.getTime() - 30 * 86400000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new BadRequestException('Invalid audit date range');
    }
    if (to.getTime() - from.getTime() > 90 * 86400000) {
      throw new BadRequestException('Audit date range cannot exceed 90 days');
    }
    return { from, to };
  }

  private decodeCursor(cursor?: string): { occurredAt: Date; id: string } | null {
    if (!cursor) return null;
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      const occurredAt = new Date(parsed.occurredAt);
      if (!parsed.id || Number.isNaN(occurredAt.getTime())) throw new Error();
      return { occurredAt, id: String(parsed.id) };
    } catch {
      throw new BadRequestException('Invalid audit cursor');
    }
  }

  serialize(row: AuditLog) {
    const occurredAt = row.occurred_at ?? row.created_at;
    return {
      id: row.id,
      schemaVersion: row.schema_version ?? 1,
      organizationId: row.organization_id,
      projectId: row.project_id,
      action: row.action,
      actor: {
        type: row.actor_type ?? (row.admin_id ? 'admin' : 'system'),
        id: row.actor_id ?? (row.admin_id ? String(row.admin_id) : null),
        label: row.actor_label ?? (row.admin_id ? 'Platform administrator' : 'Legacy system'),
        responsibleUserId: row.responsible_user_id,
      },
      subject: {
        type: row.subject_type ?? null,
        id: row.subject_id ?? (row.target_user_id ? String(row.target_user_id) : null),
        label: row.subject_label,
      },
      source: row.source ?? 'admin',
      outcome: row.outcome ?? 'success',
      before: row.before_changes ?? null,
      after: row.after_changes ?? null,
      metadata: this.sanitizer.sanitizeMetadata(row.metadata),
      requestId: row.request_id,
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      occurredAt: occurredAt.toISOString(),
    };
  }

  async list(user: any, organizationId: string, filters: ListAuditEventsDto) {
    const scope = await this.scope(user, organizationId, filters.projectId);
    const { from, to } = this.dates(filters);
    const cursor = this.decodeCursor(filters.cursor);
    const limit = filters.limit ?? 50;
    const qb = this.audits.createQueryBuilder('audit')
      .where('audit.organization_id = :organizationId', { organizationId })
      .andWhere('COALESCE(audit.occurred_at, audit.created_at) BETWEEN :from AND :to', { from, to });
    if (!scope.organizationAdmin || filters.projectId) qb.andWhere('audit.project_id = :projectId', { projectId: scope.projectIds[0] });
    const scalarFilters: Array<[keyof ListAuditEventsDto, string]> = [
      ['action', 'action'], ['actorType', 'actor_type'], ['actorId', 'actor_id'],
      ['subjectType', 'subject_type'], ['subjectId', 'subject_id'], ['source', 'source'],
      ['outcome', 'outcome'], ['correlationId', 'correlation_id'],
    ];
    for (const [input, column] of scalarFilters) {
      const value = filters[input];
      if (value !== undefined) qb.andWhere(`audit.${column} = :${String(input)}`, { [input]: value });
    }
    if (cursor) {
      qb.andWhere(new Brackets((nested) => nested
        .where('COALESCE(audit.occurred_at, audit.created_at) < :cursorDate', { cursorDate: cursor.occurredAt })
        .orWhere('(COALESCE(audit.occurred_at, audit.created_at) = :cursorDate AND audit.id < :cursorId)', { cursorDate: cursor.occurredAt, cursorId: cursor.id })));
    }
    const rows = await qb.orderBy('COALESCE(audit.occurred_at, audit.created_at)', 'DESC')
      .addOrderBy('audit.id', 'DESC').take(limit + 1).getMany();
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => this.serialize(row)),
      nextCursor: hasMore && last ? Buffer.from(JSON.stringify({
        occurredAt: (last.occurred_at ?? last.created_at).toISOString(), id: last.id,
      })).toString('base64url') : null,
    };
  }

  async detail(user: any, organizationId: string, id: string, projectId?: number) {
    const scope = await this.scope(user, organizationId, projectId);
    const row = await this.audits.findOne({ where: { id, organization_id: organizationId } });
    if (!row || (!scope.organizationAdmin && row.project_id !== scope.projectIds[0])) {
      throw new NotFoundException('Audit event not found');
    }
    return this.serialize(row);
  }
}
