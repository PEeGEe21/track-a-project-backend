import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(UserOrganization)
    private userOrgRepository: Repository<UserOrganization>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    if (!user.userOrganizations?.some((uo) => uo.organization_id === orgId)) {
      throw new ForbiddenException('User does not belong to this organization');
    }

    // Verify user belongs to this organization
    const userOrg = await this.userOrgRepository.findOne({
      where: {
        user_id: user.userId,
        organization_id: orgId,
      },
      relations: ['organization'],
    });

    if (!userOrg) {
      throw new ForbiddenException(
        'User does not have access to this organization',
      );
    }

    if (!userOrg.organization.is_active) {
      throw new ForbiddenException('Organization is not active');
    }

    if (!userOrg.is_active) {
      throw new ForbiddenException(
        'User does not have access to this organization',
      );
    }

    // Attach the organization context for later use
    request.organizationId = orgId;
    const orgData = user.userOrganizations.find(
      (uo) => uo.organization_id === orgId,
    );
    request.organizationRole = orgData.role;
    request.organizationSubscriptionTier = orgData.subscription_tier;

    return true;
  }
}
