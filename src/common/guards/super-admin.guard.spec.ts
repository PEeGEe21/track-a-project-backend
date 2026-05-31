import { ExecutionContext } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  const createContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  it('allows super admins', () => {
    expect(
      guard.canActivate(createContext({ role: 'super_admin' })),
    ).toBe(true);
  });

  it('rejects non super admins', () => {
    expect(() =>
      guard.canActivate(createContext({ role: 'member' })),
    ).toThrow('Super admin access required');
  });
});
