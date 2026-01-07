import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.headers['x-organization-id'];

    if (!user) throw new ForbiddenException('No user found');

    // Super admin bypass
    if (user.role === 'super_admin') return true;

    // Must provide an organization header
    if (!orgId) {
      throw new ForbiddenException('Organization header is missing');
    }

    // Check if user belongs to the organization
    if (!user.userOrganizations?.some(uo => uo.organization_id === orgId)) {
      throw new ForbiddenException('User does not belong to this organization');
    }

    // Attach the organization context for later use
    request.organizationId = orgId;
    const orgData = user.userOrganizations.find(uo => uo.organization_id === orgId);
    request.organizationRole = orgData.role;
    request.organizationSubscriptionTier = orgData.organization.subscription_tier;

    return true;
  }
}
