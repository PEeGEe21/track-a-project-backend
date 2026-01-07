// src/common/decorators/organization.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Returns the current request's organization ID.
 * This comes from the OrganizationAccessGuard which reads x-organization-id header.
 */
export const Organization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.organizationId;
  },
);
