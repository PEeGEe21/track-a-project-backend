import { EntitlementsService } from './entitlements.service';
import { CAPABILITY_CATALOG, CapabilityKey } from './capability-catalog';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

describe('EntitlementsService', () => {
  const organizationRepository = { findOne: jest.fn() };
  const settingsRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn((value) => value),
  };
  const auditLogRepository = { save: jest.fn() };
  const userOrganizationRepository = { findOne: jest.fn() };
  let service: EntitlementsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new EntitlementsService(
      organizationRepository as any,
      settingsRepository as any,
      auditLogRepository as any,
      userOrganizationRepository as any,
    );
  });

  it('keeps a capability disabled until rollout is explicitly enabled', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      subscription_tier: SubscriptionTier.FREE,
    });
    settingsRepository.findOne.mockResolvedValue(null);

    await expect(service.resolveOrganization('org-1')).resolves.toEqual([
      expect.objectContaining({
        key: CapabilityKey.PERSONAL_PRODUCTIVITY_HUB,
        override: null,
        planEligible: true,
        enabled: false,
        reason: 'disabled_by_default_rollout',
      }),
    ]);
  });

  it('enables an eligible capability through an organization override', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      subscription_tier: SubscriptionTier.FREE,
    });
    settingsRepository.findOne.mockResolvedValue({
      feature_overrides: {
        [CapabilityKey.PERSONAL_PRODUCTIVITY_HUB]: true,
      },
    });

    await expect(service.resolveOrganization('org-1')).resolves.toEqual([
      expect.objectContaining({
        enabled: true,
        reason: 'enabled_by_organization_override',
      }),
    ]);
  });

  it('does not allow an override to bypass the minimum subscription tier', async () => {
    const definition =
      CAPABILITY_CATALOG[CapabilityKey.PERSONAL_PRODUCTIVITY_HUB];
    const originalTier = definition.minimumTier;
    definition.minimumTier = SubscriptionTier.BASIC;
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      subscription_tier: SubscriptionTier.FREE,
    });
    settingsRepository.findOne.mockResolvedValue({
      feature_overrides: {
        [CapabilityKey.PERSONAL_PRODUCTIVITY_HUB]: true,
      },
    });

    try {
      await expect(service.resolveOrganization('org-1')).resolves.toEqual([
        expect.objectContaining({
          override: true,
          planEligible: false,
          enabled: false,
          reason: 'subscription_tier_too_low',
        }),
      ]);
    } finally {
      definition.minimumTier = originalTier;
    }
  });

  it('denies effective access when the actor lacks organization permission', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      subscription_tier: SubscriptionTier.FREE,
    });
    settingsRepository.findOne.mockResolvedValue({
      feature_overrides: {
        [CapabilityKey.PERSONAL_PRODUCTIVITY_HUB]: true,
      },
    });
    userOrganizationRepository.findOne.mockResolvedValue(null);

    await expect(
      service.resolveForActor(
        { userId: 7, email: 'user@example.com', role: 'user' },
        'org-1',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        permissionGranted: false,
        enabled: false,
        reason: 'user_permission_denied',
      }),
    ]);
  });

  it('audits the actor and previous value when an override changes', async () => {
    const organization = {
      id: 'org-1',
      subscription_tier: SubscriptionTier.FREE,
    };
    const settings = {
      feature_overrides: {
        [CapabilityKey.PERSONAL_PRODUCTIVITY_HUB]: false,
      },
    };
    organizationRepository.findOne.mockResolvedValue(organization);
    settingsRepository.findOne.mockResolvedValue(settings);

    await service.setOrganizationOverride(
      { userId: 9, email: 'admin@example.com', role: 'super_admin' },
      'org-1',
      CapabilityKey.PERSONAL_PRODUCTIVITY_HUB,
      true,
    );

    expect(auditLogRepository.save).toHaveBeenCalledWith({
      action: 'ENTITLEMENT_OVERRIDE_CHANGE',
      admin_id: 9,
      organization_id: 'org-1',
      metadata: {
        capability: CapabilityKey.PERSONAL_PRODUCTIVITY_HUB,
        previous_value: false,
        new_value: true,
      },
    });
  });

  it('clears an override back to catalog inheritance and audits it', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      subscription_tier: SubscriptionTier.FREE,
    });
    const settings = {
      feature_overrides: {
        [CapabilityKey.PERSONAL_PRODUCTIVITY_HUB]: true,
      },
    };
    settingsRepository.findOne.mockResolvedValue(settings);

    await service.clearOrganizationOverride(
      { userId: 9, email: 'admin@example.com', role: 'super_admin' },
      'org-1',
      CapabilityKey.PERSONAL_PRODUCTIVITY_HUB,
    );

    expect(settingsRepository.save).toHaveBeenCalledWith({
      feature_overrides: {},
    });
    expect(auditLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          previous_value: true,
          new_value: null,
        }),
      }),
    );
  });
});
