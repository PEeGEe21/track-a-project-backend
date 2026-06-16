import { ExecutionContext } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { OrganizationAccessGuard } from './organization_access.guard';

describe('OrganizationAccessGuard', () => {
  let guard: OrganizationAccessGuard;
  const userOrgRepository = {
    findOne: jest.fn(),
  };

  const createContext = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationAccessGuard,
        {
          provide: getRepositoryToken(UserOrganization),
          useValue: userOrgRepository,
        },
      ],
    }).compile();

    guard = module.get<OrganizationAccessGuard>(OrganizationAccessGuard);
    jest.clearAllMocks();
  });

  it('allows access when the header matches the active organization', async () => {
    userOrgRepository.findOne.mockResolvedValue({
      organization: { is_active: true },
      is_active: true,
    });
    const request: any = {
      user: {
        userId: 9,
        role: 'member',
        currentOrganizationId: 'org_1',
        userOrganizations: [
          {
            organization_id: 'org_1',
            role: 'org_admin',
            subscription_tier: 'free',
          },
        ],
      },
      headers: {
        'x-organization-id': 'org_1',
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.organizationId).toBe('org_1');
    expect(request.organizationRole).toBe('org_admin');
  });

  it('rejects requests that target a different organization than the active token scope', async () => {
    const request: any = {
      user: {
        userId: 9,
        role: 'member',
        currentOrganizationId: 'org_1',
        userOrganizations: [
          {
            organization_id: 'org_1',
            role: 'org_admin',
            subscription_tier: 'free',
          },
          {
            organization_id: 'org_2',
            role: 'member',
            subscription_tier: 'free',
          },
        ],
      },
      headers: {
        'x-organization-id': 'org_2',
      },
    };

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      'Organization header does not match the active organization',
    );
    expect(userOrgRepository.findOne).not.toHaveBeenCalled();
  });
});
