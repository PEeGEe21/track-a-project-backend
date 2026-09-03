import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditReaderService } from './audit-reader.service';
import { OrganizationRole } from 'src/utils/constants/org_roles';

describe('AuditReaderService', () => {
  const qb: any = {};
  ['where', 'andWhere', 'orderBy', 'addOrderBy', 'take'].forEach((method) => {
    qb[method] = jest.fn(() => qb);
  });
  qb.getMany = jest.fn();
  const audits: any = { createQueryBuilder: jest.fn(() => qb), findOne: jest.fn() };
  const memberships: any = { findOne: jest.fn() };
  const projectPeers: any = { findOne: jest.fn() };
  const entitlements: any = { assertCapability: jest.fn() };
  const sanitizer: any = { sanitizeMetadata: jest.fn((value) => value) };
  const service = new AuditReaderService(audits, memberships, projectPeers, entitlements, sanitizer);
  const user = { userId: 7 };

  beforeEach(() => {
    jest.clearAllMocks();
    memberships.findOne.mockResolvedValue({ role: OrganizationRole.ORG_ADMIN });
    qb.getMany.mockResolvedValue([]);
  });

  it('lists only the selected tenant with deterministic ordering', async () => {
    await expect(service.list(user, 'org-1', { limit: 25 })).resolves.toEqual({ items: [], nextCursor: null });
    expect(entitlements.assertCapability).toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith('audit.organization_id = :organizationId', { organizationId: 'org-1' });
    expect(qb.orderBy).toHaveBeenCalledWith('COALESCE(audit.occurred_at, audit.created_at)', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('audit.id', 'DESC');
    expect(qb.take).toHaveBeenCalledWith(26);
  });

  it('requires non-admin readers to provide an owned project', async () => {
    memberships.findOne.mockResolvedValue({ role: OrganizationRole.MEMBER });
    await expect(service.list(user, 'org-1', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses a non-enumerating not-found response for cross-tenant detail', async () => {
    audits.findOne.mockResolvedValue(null);
    await expect(service.detail(user, 'org-1', 'event-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects ranges over 90 days', async () => {
    await expect(service.list(user, 'org-1', { from: '2025-01-01', to: '2025-05-01' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
