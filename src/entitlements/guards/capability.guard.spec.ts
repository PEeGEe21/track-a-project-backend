import { CapabilityKey } from '../capability-catalog';
import { CapabilityGuard } from './capability.guard';

describe('CapabilityGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const entitlementsService = { assertCapability: jest.fn() };
  const request = {
    user: { userId: 7 },
    organizationId: 'org-1',
    headers: {},
  };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  };

  beforeEach(() => jest.resetAllMocks());

  it('enforces the capability selected by route metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(
      CapabilityKey.PERSONAL_PRODUCTIVITY_HUB,
    );
    entitlementsService.assertCapability.mockResolvedValue({ enabled: true });
    const guard = new CapabilityGuard(
      reflector as any,
      entitlementsService as any,
    );

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
    expect(entitlementsService.assertCapability).toHaveBeenCalledWith(
      request.user,
      'org-1',
      CapabilityKey.PERSONAL_PRODUCTIVITY_HUB,
    );
  });

  it('does nothing when a route does not declare a capability', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const guard = new CapabilityGuard(
      reflector as any,
      entitlementsService as any,
    );

    await expect(guard.canActivate(context as any)).resolves.toBe(true);
    expect(entitlementsService.assertCapability).not.toHaveBeenCalled();
  });
});
