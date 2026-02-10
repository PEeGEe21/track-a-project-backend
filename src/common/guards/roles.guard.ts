import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.headers['x-organization-id'];

    console.log(user, "user")
    if (!user) return false;

    if (user?.role === 'super_admin') return true;

    const orgData = user.userOrganizations.find(uo => uo.organization_id === orgId);
    if (!orgData) {
      throw new ForbiddenException('User does not belong to this organization');
    }

    // System-level roles (super_admin)
    if (orgData?.role && requiredRoles.includes(orgData?.role)) return true;

    return false;
  }
}
