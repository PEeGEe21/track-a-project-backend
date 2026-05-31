import { OrganizationsController } from './organizations.controller';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  const organizationsService = {
    createInvitation: jest.fn(),
    getCurrentPlanAndLimits: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(() => {
    controller = new OrganizationsController(organizationsService as any);
    jest.clearAllMocks();
  });

  it('adds the authenticated inviter when creating an invitation', async () => {
    organizationsService.createInvitation.mockResolvedValue({ success: true });
    const dto = { organization_id: 'org_1', emails: ['user@example.com'] };
    const req = { user: { userId: 21 } };

    await expect(controller.createInvitation(dto as any, req as any)).resolves.toEqual({
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

    await expect(controller.getCurrentPlanAndLimits('org_99')).resolves.toEqual({
      plan: 'free',
    });
    expect(organizationsService.getCurrentPlanAndLimits).toHaveBeenCalledWith(
      'org_99',
    );
  });
});
