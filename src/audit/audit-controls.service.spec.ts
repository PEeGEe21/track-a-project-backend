import { NotFoundException } from '@nestjs/common';
import { AuditControlsService } from './audit-controls.service';

describe('AuditControlsService', () => {
  const exportsRepo: any = { find: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn() };
  const policies: any = { findOne: jest.fn() };
  const purges: any = { findOne: jest.fn(), update: jest.fn() };
  const audits: any = { createQueryBuilder: jest.fn() };
  const reader: any = { assertOrganizationAdmin: jest.fn(), serialize: jest.fn() };
  const writer: any = { correlationId: jest.fn(() => 'correlation'), append: jest.fn() };
  const dataSource: any = { transaction: jest.fn() };
  const service = new AuditControlsService(exportsRepo, policies, purges, audits, reader, writer, dataSource);

  beforeEach(() => jest.clearAllMocks());

  it('neutralizes every spreadsheet formula prefix', () => {
    for (const value of ['=cmd()', '+1', '-2', '@SUM(A1)', '\ttab', '\rreturn']) {
      expect((service as any).neutralize(value)).toBe(`'${value}`);
    }
    expect((service as any).neutralize('safe')).toBe('safe');
  });

  it('does not query exports when organization-admin authorization fails', async () => {
    reader.assertOrganizationAdmin.mockRejectedValue(new NotFoundException());
    await expect(service.listExports({ userId: 7 }, 'other-org')).rejects.toBeInstanceOf(NotFoundException);
    expect(exportsRepo.find).not.toHaveBeenCalled();
  });

  it('binds export status to both tenant and requesting user', async () => {
    reader.assertOrganizationAdmin.mockResolvedValue(undefined);
    exportsRepo.find.mockResolvedValue([]);
    await service.listExports({ userId: 7 }, 'org-1');
    expect(exportsRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { organization_id: 'org-1', requested_by_user_id: 7 },
      take: 50,
    }));
  });
});
