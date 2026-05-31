import { UsersController } from './users.controller';

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = {
    getUserProfile: jest.fn(),
    sendPeerInvite: jest.fn(),
    getUserAccountById: jest.fn(),
  };

  beforeEach(() => {
    controller = new UsersController(usersService as any);
    jest.clearAllMocks();
  });

  it('loads the current user profile from the authenticated request', () => {
    const req = { user: { userId: 9 } };
    usersService.getUserProfile.mockReturnValue({ id: 9 });

    expect(controller.getUserProfile(req)).toEqual({ id: 9 });
    expect(usersService.getUserProfile).toHaveBeenCalledWith(req.user);
  });

  it('passes organization context when sending peer invites', () => {
    const inviteData = { emails: 'peer@example.com', selectedRole: 'member' };
    const req = { user: { userId: 4 } };
    usersService.sendPeerInvite.mockReturnValue({ success: true });

    expect(controller.sendPeerInvite(inviteData, req, 'org_1')).toEqual({
      success: true,
    });
    expect(usersService.sendPeerInvite).toHaveBeenCalledWith(
      req.user,
      inviteData,
      'org_1',
    );
  });

  it('delegates privileged user lookup by id', () => {
    usersService.getUserAccountById.mockReturnValue({ id: 12 });

    expect(controller.getUser(12)).toEqual({ id: 12 });
    expect(usersService.getUserAccountById).toHaveBeenCalledWith(12);
  });
});
