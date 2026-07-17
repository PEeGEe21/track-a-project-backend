import { ProjectPermission } from 'src/common/authorization/authorization.service';
import { StatusService } from './status.service';

describe('StatusService', () => {
  const users = { findOne: jest.fn() };
  const projects = { findOne: jest.fn() };
  const statuses = { find: jest.fn() };
  const authorization = { assertProjectPermission: jest.fn() };
  let service: StatusService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new StatusService(
      users as any,
      {} as any,
      projects as any,
      {} as any,
      statuses as any,
      authorization as any,
    );
  });

  it('checks project view permission before listing statuses', async () => {
    users.findOne.mockResolvedValue({ id: 3 });
    projects.findOne.mockResolvedValue({ id: 8 });
    statuses.find.mockResolvedValue([]);

    await service.findStatuses(8, { userId: 3 } as any, 'org-1');

    expect(authorization.assertProjectPermission).toHaveBeenCalledWith(
      { userId: 3 },
      'org-1',
      8,
      ProjectPermission.VIEW,
    );
  });
});
