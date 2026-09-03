import { EntitlementsService } from './entitlements.service';
import { CAPABILITY_CATALOG, CapabilityKey } from './capability-catalog';
import { SubscriptionTier } from 'src/utils/constants/subscriptionTier';

describe('EntitlementsService', () => {
  const organizationRepository = { findOne: jest.fn() };
  const settingsRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn((value) => value),
    manager: {
      transaction: jest.fn(async (work) =>
        work({ getRepository: () => settingsRepository }),
      ),
    },
  };
  const auditLogRepository = { save: jest.fn() };
  const auditWriter = {
    append: jest.fn(),
    correlationId: jest.fn().mockReturnValue('correlation-1'),
  };
  const userOrganizationRepository = { findOne: jest.fn() };
  let service: EntitlementsService;

  beforeEach(() => {
    jest.resetAllMocks();
    settingsRepository.manager.transaction.mockImplementation(async (work) =>
      work({ getRepository: () => settingsRepository }),
    );
    auditWriter.correlationId.mockReturnValue('correlation-1');
    service = new EntitlementsService(
      organizationRepository as any,
      settingsRepository as any,
      userOrganizationRepository as any,
      auditWriter as any,
    );
  });

  it('keeps a capability disabled until rollout is explicitly enabled', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      subscription_tier: SubscriptionTier.FREE,
    });
    settingsRepository.findOne.mockResolvedValue(null);

    await expect(service.resolveOrganization('org-1')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: CapabilityKey.PERSONAL_PRODUCTIVITY_HUB,
          override: null,
          planEligible: true,
          enabled: false,
          reason: 'disabled_by_default_rollout',
        }),
      ]),
    );
  });

  it('keeps AI assistance default-off for explicit pilot activation', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 'org-1',
      subscription_tier: SubscriptionTier.FREE,
    });
    settingsRepository.findOne.mockResolvedValue(null);
    await expect(service.resolveOrganization('org-1')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: CapabilityKey.AI_ASSISTANCE,
          enabled: false,
          reason: 'disabled_by_default_rollout',
        }),
      ]),
    );
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

    await expect(service.resolveOrganization('org-1')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enabled: true,
          reason: 'enabled_by_organization_override',
        }),
      ]),
    );
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
      await expect(service.resolveOrganization('org-1')).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            override: true,
            planEligible: false,
            enabled: false,
            reason: 'subscription_tier_too_low',
          }),
        ]),
      );
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
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          permissionGranted: false,
          enabled: false,
          reason: 'user_permission_denied',
        }),
      ]),
    );
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

    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: 'org-1',
        action: 'entitlement.override_changed',
        actor: expect.objectContaining({ type: 'admin', id: 9 }),
        before: expect.objectContaining({ enabled: false }),
        after: expect.objectContaining({ enabled: true }),
      }),
    );
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
    expect(auditWriter.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        before: expect.objectContaining({ enabled: true }),
        after: expect.objectContaining({ enabled: null }),
      }),
    );
  });
});
