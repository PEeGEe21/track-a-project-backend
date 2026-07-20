import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { SidebarProjectsService } from './sidebar-projects.service';

describe('SidebarProjectsService', () => {
  const actor = { userId: 5, email: 'member@example.com', role: 'member' };
  let pins: any;
  let organizations: any;
  let authorization: any;
  let dataSource: any;
  let service: SidebarProjectsService;

  beforeEach(() => {
    pins = {
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(),
      countBy: jest.fn(),
      maximum: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'pin-1', ...value })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn(),
    };
    organizations = {
      findOne: jest.fn().mockResolvedValue({
        activeSubscription: { price: { plan: { sidebar_project_pin_limit: 4 } } },
      }),
    };
    authorization = {
      assertProjectPermission: jest.fn().mockResolvedValue({
        project: { id: 9 },
        role: 'viewer',
      }),
    };
    dataSource = { transaction: jest.fn(async (callback) => callback({ update: jest.fn() })) };
    service = new SidebarProjectsService(
      pins,
      organizations,
      authorization,
      dataSource,
    );
  });

  it('returns the existing pin idempotently', async () => {
    pins.findOneBy.mockResolvedValue({ id: 'existing', project_id: 9 });

    const result = await service.pin(actor as any, 'org-1', 9);

    expect(result.created).toBe(false);
    expect(pins.save).not.toHaveBeenCalled();
  });

  it('enforces the configured plan allowance', async () => {
    pins.findOneBy.mockResolvedValue(null);
    pins.countBy.mockResolvedValue(4);

    await expect(service.pin(actor as any, 'org-1', 9)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(pins.save).not.toHaveBeenCalled();
  });

  it('caps a configured allowance at the product maximum of ten', async () => {
    organizations.findOne.mockResolvedValue({
      activeSubscription: { price: { plan: { sidebar_project_pin_limit: 50 } } },
    });
    pins.findOneBy.mockResolvedValue(null);
    pins.countBy.mockResolvedValue(10);

    await expect(service.pin(actor as any, 'org-1', 9)).rejects.toMatchObject({
      response: expect.objectContaining({ limit: 10 }),
    });
  });

  it('unpins idempotently without checking project access', async () => {
    pins.delete.mockResolvedValue({ affected: 0 });

    await expect(service.unpin(actor as any, 'org-1', 9)).resolves.toEqual({
      success: true,
    });
    expect(authorization.assertProjectPermission).not.toHaveBeenCalled();
  });

  it('rejects reorder requests that omit a current pin', async () => {
    pins.find.mockResolvedValue([{ project_id: 9 }, { project_id: 10 }]);

    await expect(
      service.reorder(actor as any, 'org-1', [9]),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
