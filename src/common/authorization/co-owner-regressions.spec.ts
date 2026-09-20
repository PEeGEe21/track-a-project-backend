import { DecisionsService } from 'src/decisions/decisions.service';
import { ProjectUpdatesService } from 'src/project-updates/project-updates.service';
import { ResourcesService } from 'src/resources/services/resources.service';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { ProjectPermission } from './authorization.service';

describe('co-owner regressions', () => {
  const creator = { id: 1 };
  const coOwner = { id: 2 };
  const project = { id: 7, organization_id: 'org-1', user: creator };
  const membership = { user: coOwner, role: ProjectRole.OWNER };

  it('treats a confirmed owner-role member as an owner for project updates', async () => {
    const service = new ProjectUpdatesService(
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue(project) } as any,
      { findOne: jest.fn().mockResolvedValue(membership) } as any,
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue(coOwner) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      (service as any).assertAccess({ userId: 2 }, 'org-1', 7),
    ).resolves.toMatchObject({
      isOwner: true,
      role: ProjectRole.OWNER,
      canManage: true,
    });
  });

  it('treats a confirmed owner-role member as an owner for decisions', async () => {
    const service = new DecisionsService(
      {} as any,
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue(project) } as any,
      { findOne: jest.fn().mockResolvedValue(membership) } as any,
      { findOne: jest.fn().mockResolvedValue(coOwner) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      (service as any).access({ userId: 2 }, 'org-1', 7),
    ).resolves.toMatchObject({
      isOwner: true,
      role: ProjectRole.OWNER,
      canManage: true,
    });
  });

  it('authorizes a non-author resource change through resolved project permissions', async () => {
    const resources = {
      save: jest.fn(async (resource) => resource),
    };
    const users = { findOneBy: jest.fn().mockResolvedValue(coOwner) };
    const authorization = {
      assertProjectPermission: jest.fn().mockResolvedValue({
        project,
        role: ProjectRole.OWNER,
      }),
    };
    const service = new ResourcesService(
      resources as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      users as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      authorization as any,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 20,
      title: 'Runbook',
      createdBy: { id: 3 },
      project,
      organization_id: 'org-1',
    } as any);

    await service.update(20, { title: 'Updated runbook' }, { userId: 2 });

    expect(authorization.assertProjectPermission).toHaveBeenCalledWith(
      { userId: 2 },
      'org-1',
      7,
      ProjectPermission.EDIT,
    );
  });
});
