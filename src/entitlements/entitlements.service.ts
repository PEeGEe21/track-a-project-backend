import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { Organization } from 'src/typeorm/entities/Organization';
import { OrganizationSettings } from 'src/typeorm/entities/OrganizationSettings';
import { AuthUser } from 'src/types/users';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';
import { Repository } from 'typeorm';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import {
  CAPABILITY_CATALOG,
  CapabilityKey,
} from './capability-catalog';

const tierRank: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.BASIC]: 1,
  [SubscriptionTier.PROFESSIONAL]: 2,
  [SubscriptionTier.ENTERPRISE]: 3,
};

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationSettings)
    private readonly settingsRepository: Repository<OrganizationSettings>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(UserOrganization)
    private readonly userOrganizationRepository: Repository<UserOrganization>,
  ) {}

  async resolveOrganization(organizationId: string, permissionGranted = true) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const settings = await this.settingsRepository.findOne({
      where: { organization_id: organizationId },
    });
    const overrides = settings?.feature_overrides ?? {};

    return Object.values(CAPABILITY_CATALOG).map((definition) => {
      const override = overrides[definition.key];
      const rolloutEnabled = override ?? definition.defaultEnabled;
      const planEligible =
        tierRank[organization.subscription_tier] >=
        tierRank[definition.minimumTier];
      const enabled = rolloutEnabled && planEligible && permissionGranted;

      return {
        ...definition,
        organizationTier: organization.subscription_tier,
        override: override ?? null,
        planEligible,
        permissionGranted,
        enabled,
        reason: !rolloutEnabled
          ? override === false
            ? 'disabled_by_organization_override'
            : 'disabled_by_default_rollout'
          : !planEligible
            ? 'subscription_tier_too_low'
            : !permissionGranted
              ? 'user_permission_denied'
              : override === true
              ? 'enabled_by_organization_override'
              : 'enabled_by_default_rollout',
      };
    });
  }

  async resolveForActor(actor: AuthUser, organizationId: string) {
    const permissionGranted =
      actor.role === 'super_admin' ||
      Boolean(
        await this.userOrganizationRepository.findOne({
          where: {
            user_id: actor.userId,
            organization_id: organizationId,
            is_active: true,
          },
        }),
      );
    return this.resolveOrganization(organizationId, permissionGranted);
  }

  async assertCapability(
    actor: AuthUser,
    organizationId: string,
    capability: CapabilityKey,
  ) {
    const resolved = await this.resolveForActor(actor, organizationId);
    const entitlement = resolved.find((item) => item.key === capability);
    if (!entitlement?.enabled) {
      throw new ForbiddenException({
        message: 'Capability is not available',
        capability,
        reason: entitlement?.reason ?? 'unknown_capability',
      });
    }
    return entitlement;
  }

  async setOrganizationOverride(
    actor: AuthUser,
    organizationId: string,
    capability: CapabilityKey,
    enabled: boolean,
  ) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    let settings = await this.settingsRepository.findOne({
      where: { organization_id: organizationId },
    });
    if (!settings) {
      settings = this.settingsRepository.create({
        organization_id: organizationId,
        organization,
        feature_overrides: {},
      });
    }

    const previousValue = settings.feature_overrides?.[capability] ?? null;
    settings.feature_overrides = {
      ...(settings.feature_overrides ?? {}),
      [capability]: enabled,
    };
    await this.settingsRepository.save(settings);
    await this.auditLogRepository.save({
      action: 'ENTITLEMENT_OVERRIDE_CHANGE',
      admin_id: actor.userId,
      organization_id: organizationId,
      metadata: {
        capability,
        previous_value: previousValue,
        new_value: enabled,
      },
    });

    return this.resolveOrganization(organizationId);
  }

  async clearOrganizationOverride(
    actor: AuthUser,
    organizationId: string,
    capability: CapabilityKey,
  ) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    const settings = await this.settingsRepository.findOne({
      where: { organization_id: organizationId },
    });
    const previousValue = settings?.feature_overrides?.[capability] ?? null;
    if (settings) {
      const overrides = { ...(settings.feature_overrides ?? {}) };
      delete overrides[capability];
      settings.feature_overrides = overrides;
      await this.settingsRepository.save(settings);
    }
    await this.auditLogRepository.save({
      action: 'ENTITLEMENT_OVERRIDE_CHANGE',
      admin_id: actor.userId,
      organization_id: organizationId,
      metadata: {
        capability,
        previous_value: previousValue,
        new_value: null,
      },
    });
    return this.resolveOrganization(organizationId);
  }
}
