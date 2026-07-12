import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationRole } from 'src/utils/constants/org_roles';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  const projectRepository = { findOne: jest.fn() };
  const projectPeerRepository = { exists: jest.fn() };
  const userOrganizationRepository = { findOne: jest.fn() };
  let service: AuthorizationService;

  const params = {
    actor: { userId: 7, email: 'user@example.com', role: 'user' },
    organizationId: '11111111-1111-1111-1111-111111111111',
    projectId: 42,
    action: 'read' as const,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthorizationService(
      projectRepository as any,
      projectPeerRepository as any,
      userOrganizationRepository as any,
    );
  });

  it('does not reveal a project outside the selected organization', async () => {
    projectRepository.findOne.mockResolvedValue(null);

    await expect(service.assertProjectAccess(params)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(projectRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42, organization_id: params.organizationId },
      }),
    );
  });

  it('denies a user without an active organization membership', async () => {
    projectRepository.findOne.mockResolvedValue({ id: 42, user: { id: 9 } });
    userOrganizationRepository.findOne.mockResolvedValue(null);

    await expect(service.assertProjectAccess(params)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns an unrestricted project scope for an organization admin', async () => {
    userOrganizationRepository.findOne.mockResolvedValue({
      role: OrganizationRole.ORG_ADMIN,
    });

    await expect(
      service.getProjectAccessScope(params.actor, params.organizationId),
    ).resolves.toEqual({ canAccessAllProjects: true, userId: 7 });
  });

  it('returns a restricted project scope for a regular member', async () => {
    userOrganizationRepository.findOne.mockResolvedValue({
      role: OrganizationRole.MEMBER,
    });

    await expect(
      service.getProjectAccessScope(params.actor, params.organizationId),
    ).resolves.toEqual({ canAccessAllProjects: false, userId: 7 });
  });

  it('allows an active organization admin', async () => {
    const project = { id: 42, user: { id: 9 } };
    projectRepository.findOne.mockResolvedValue(project);
    userOrganizationRepository.findOne.mockResolvedValue({
      role: OrganizationRole.ORG_ADMIN,
    });

    await expect(service.assertProjectAccess(params)).resolves.toBe(project);
    expect(projectPeerRepository.exists).not.toHaveBeenCalled();
  });

  it('allows a confirmed connected project member', async () => {
    const project = { id: 42, user: { id: 9 } };
    projectRepository.findOne.mockResolvedValue(project);
    userOrganizationRepository.findOne.mockResolvedValue({
      role: OrganizationRole.MEMBER,
    });
    projectPeerRepository.exists.mockResolvedValue(true);

    await expect(service.assertProjectAccess(params)).resolves.toBe(project);
  });

  it('denies an organization member with no project relationship', async () => {
    projectRepository.findOne.mockResolvedValue({ id: 42, user: { id: 9 } });
    userOrganizationRepository.findOne.mockResolvedValue({
      role: OrganizationRole.MEMBER,
    });
    projectPeerRepository.exists.mockResolvedValue(false);

    await expect(service.assertProjectAccess(params)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
