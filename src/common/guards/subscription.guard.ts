import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

const tierHierarchy = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.BASIC]: 1,
  [SubscriptionTier.PROFESSIONAL]: 2,
  [SubscriptionTier.ENTERPRISE]: 3,
};

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTier = this.reflector.getAllAndOverride<SubscriptionTier>('tier', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredTier) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.headers['x-organization-id'];

    // Super admins bypass subscription checks
    if (user?.role === 'super_admin') return true;

    const orgData = user.userOrganizations.find(uo => uo.organization_id === orgId);
    if (!orgData) {
      throw new ForbiddenException('User does not belong to this organization');
    }

    const userTier = orgData.subscription_tier;
    if (!userTier) {
      throw new ForbiddenException('Organization subscription not found');
    }

    const userTierLevel = tierHierarchy[userTier];
    const requiredTierLevel = tierHierarchy[requiredTier];

    if (userTierLevel < requiredTierLevel) {
      throw new ForbiddenException(
        `This feature requires ${requiredTier} subscription or higher`,
      );
    }

    return true;
  }
}
