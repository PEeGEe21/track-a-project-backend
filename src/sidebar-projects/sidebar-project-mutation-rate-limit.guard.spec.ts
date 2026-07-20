import { ExecutionContext } from '@nestjs/common';
import { SidebarProjectMutationRateLimitGuard } from './sidebar-project-mutation-rate-limit.guard';

describe('SidebarProjectMutationRateLimitGuard', () => {
  const contextFor = (userId: number) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user: { userId } }) }),
    }) as unknown as ExecutionContext;

  it('uses one shared key for every sidebar mutation endpoint', async () => {
    const storage = { increment: jest.fn().mockResolvedValue({ isBlocked: false }) };
    const guard = new SidebarProjectMutationRateLimitGuard(storage as any);

    await guard.canActivate(contextFor(42));
    await guard.canActivate(contextFor(42));

    expect(storage.increment).toHaveBeenNthCalledWith(
      1,
      'sidebar-project-mutations:42',
      60_000,
      30,
      60_000,
      'sidebar-project-mutations',
    );
    expect(storage.increment.mock.calls[1][0]).toBe(
      'sidebar-project-mutations:42',
    );
  });

  it('returns 429 before a mutation runs when the shared limit is exceeded', async () => {
    const storage = {
      increment: jest.fn().mockResolvedValue({
        isBlocked: true,
        timeToBlockExpire: 25_000,
      }),
    };
    const guard = new SidebarProjectMutationRateLimitGuard(storage as any);

    await expect(guard.canActivate(contextFor(7))).rejects.toMatchObject({
      status: 429,
    });
  });
});
