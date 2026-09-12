import { OrganizationsController } from './organizations.controller';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  const organizationsService = {
    createInvitation: jest.fn(),
    getCurrentPlanAndLimits: jest.fn(),
    findAll: jest.fn(),
  };
  const authService = {
    createWorkspaceForAccount: jest.fn(),
    joinWorkspaceForAccount: jest.fn(),
    deleteWorkspaceForAccount: jest.fn(),
  };

  beforeEach(() => {
    controller = new OrganizationsController(
      organizationsService as any,
      authService as any,
    );
    jest.clearAllMocks();
  });

  it('creates a workspace from the authenticated account context', async () => {
    authService.createWorkspaceForAccount.mockResolvedValue({ success: true });
    const dto = { name: 'Operations' };
    const req = { user: { userId: 21, currentOrganizationId: null } };

    await expect(controller.createWorkspace(req as any, dto)).resolves.toEqual({
      success: true,
    });
    expect(authService.createWorkspaceForAccount).toHaveBeenCalledWith(
      req.user,
      dto,
    );
  });

  it('joins an invited workspace with the authenticated account', async () => {
    authService.joinWorkspaceForAccount.mockResolvedValue({ success: true });
    const dto = { invite_code: 'ABC123' };
    const req = { user: { userId: 21, currentOrganizationId: null } };

    await expect(controller.joinWorkspace(req as any, dto)).resolves.toEqual({
      success: true,
    });
    expect(authService.joinWorkspaceForAccount).toHaveBeenCalledWith(
      req.user,
      dto,
    );
  });

  it('deletes a workspace through the authenticated account lifecycle', async () => {
    authService.deleteWorkspaceForAccount.mockResolvedValue({ success: true });
    const user = {
      userId: 21,
      currentOrganizationId: '9f5a9c1c-7c91-4f6d-a6b2-e7ce08751a23',
    };
    const dto = { confirmationName: 'Test workspace' };

    await expect(
      controller.remove(user.currentOrganizationId, dto, { user }),
    ).resolves.toEqual({ success: true });
    expect(authService.deleteWorkspaceForAccount).toHaveBeenCalledWith(
      user,
      user.currentOrganizationId,
      dto,
    );
  });

  it('adds the authenticated inviter when creating an invitation', async () => {
    organizationsService.createInvitation.mockResolvedValue({ success: true });
    const dto = { organization_id: 'org_1', emails: ['user@example.com'] };
    const req = { user: { userId: 21 } };

    await expect(
      controller.createInvitation(dto as any, req as any),
    ).resolves.toEqual({
      success: true,
    });
    expect(organizationsService.createInvitation).toHaveBeenCalledWith({
      ...dto,
      invited_by: 21,
    });
  });

  it('returns current plan and limits for an organization', async () => {
    organizationsService.getCurrentPlanAndLimits.mockResolvedValue({
      plan: 'free',
    });

    await expect(controller.getCurrentPlanAndLimits('org_99')).resolves.toEqual(
      {
        plan: 'free',
      },
    );
    expect(organizationsService.getCurrentPlanAndLimits).toHaveBeenCalledWith(
      'org_99',
    );
  });
});
