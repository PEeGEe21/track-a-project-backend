import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementsService } from '../entitlements.service';
import { CapabilityKey } from '../capability-catalog';
import { REQUIRED_CAPABILITY } from '../decorators/require-capability.decorator';

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const capability = this.reflector.getAllAndOverride<CapabilityKey>(
      REQUIRED_CAPABILITY,
      [context.getHandler(), context.getClass()],
    );
    if (!capability) return true;
    const request = context.switchToHttp().getRequest();
    await this.entitlementsService.assertCapability(
      request.user,
      request.organizationId ?? request.headers['x-organization-id'],
      capability,
    );
    return true;
  }
}
