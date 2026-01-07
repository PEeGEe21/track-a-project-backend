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

    // Super admins bypass subscription checks
    if (request.user?.role === 'super_admin') return true;

    const userTier = request.organizationSubscriptionTier;
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
