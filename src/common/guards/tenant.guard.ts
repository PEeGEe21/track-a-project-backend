import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Super admins bypass tenant checks
    if (request.user?.role === 'super_admin') {
      return true;
    }

    // All other users must have an organization
    if (!request.user?.organization_id) {
      throw new ForbiddenException('No organization context');
    }

    return true;
  }
}
