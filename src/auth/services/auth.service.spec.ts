import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/services/users.service';
import { ProjectsService } from 'src/projects/services/projects.service';
import { User } from 'src/typeorm/entities/User';
import { Profile } from 'src/typeorm/entities/Profile';
import { Project } from 'src/typeorm/entities/Project';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { UserPeerInvite } from 'src/typeorm/entities/UserPeerInvite';
import { UserPeer } from 'src/typeorm/entities/UserPeer';
import { Organization } from 'src/typeorm/entities/Organization';
import { UserOrganization } from 'src/typeorm/entities/UserOrganization';
import { OrganizationInvitation } from 'src/typeorm/entities/OrganizationInvitation';
import { MailingService } from 'src/utils/mailing/mailing.service';
import { OrganizationRole } from 'src/utils/constants/org_roles';
import { AuditWriterService } from 'src/audit/audit-writer.service';
import { RefreshSession } from 'src/typeorm/entities/RefreshSession';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    getUserOrganizationsById: jest.fn(),
    getUserAccountById: jest.fn(),
  };
  const projectsService = {};
  const userRepository = {
    findOneBy: jest.fn(),
  };
  const userOrganizationRepository = {
    findOne: jest.fn(),
  };
  const jwtService = {
    decode: jest.fn(),
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };
  const refreshSessions = {
    create: jest.fn((value) => value),
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
    update: jest.fn(),
  };
  const refreshSessionRepository = {
    ...refreshSessions,
    manager: {
      transaction: jest.fn(async (work) =>
        work({ getRepository: () => refreshSessions }),
      ),
    },
  };
  const mailingService = {};
  const repoStub = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: ProjectsService, useValue: projectsService },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Profile), useValue: repoStub },
        { provide: getRepositoryToken(Project), useValue: repoStub },
        { provide: getRepositoryToken(ProjectPeer), useValue: repoStub },
        { provide: getRepositoryToken(UserPeerInvite), useValue: repoStub },
        { provide: getRepositoryToken(UserPeer), useValue: repoStub },
        { provide: getRepositoryToken(Organization), useValue: repoStub },
        {
          provide: getRepositoryToken(UserOrganization),
          useValue: userOrganizationRepository,
        },
        {
          provide: getRepositoryToken(OrganizationInvitation),
          useValue: repoStub,
        },
        {
          provide: getRepositoryToken(RefreshSession),
          useValue: refreshSessionRepository,
        },
        { provide: JwtService, useValue: jwtService },
        { provide: MailingService, useValue: mailingService },
        { provide: AuditWriterService, useValue: { append: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('preserves active organization scope when refreshing scoped tokens', async () => {
    const user = { id: 14, email: 'user@example.com', role: 'member' };
    const organization = { id: 'org_1', is_active: true };
    const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };

    jwtService.verifyAsync.mockResolvedValue({
      sub: 14,
      email: 'user@example.com',
      role: 'member',
      currentOrganizationId: 'org_1',
    });
    userRepository.findOneBy.mockResolvedValue(user);
    userOrganizationRepository.findOne.mockResolvedValue({
      user_id: 14,
      organization_id: 'org_1',
      role: OrganizationRole.ORG_ADMIN,
      is_active: true,
      organization,
    });
    jest.spyOn(service as any, 'issueTokenPair').mockResolvedValue({
      ...tokens,
      refreshJti: 'new-jti',
    });

    await expect(service.refreshToken('refresh-token')).resolves.toEqual({
      success: 'success',
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    expect(userOrganizationRepository.findOne).toHaveBeenCalledWith({
      where: {
        user_id: 14,
        organization_id: 'org_1',
        is_active: true,
      },
      relations: ['organization'],
    });
    expect((service as any).issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 14,
        currentOrganizationId: 'org_1',
        organizationRole: OrganizationRole.ORG_ADMIN,
      }),
    );
  });

  it('atomically rotates a persisted refresh token once', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    jwtService.verifyAsync.mockResolvedValue({
      sub: 14,
      email: 'user@example.com',
      role: 'member',
      jti: 'old-jti',
      familyId: 'family-1',
      tokenUse: 'refresh',
    });
    usersService.getUserOrganizationsById.mockResolvedValue([]);
    refreshSessions.findOne.mockResolvedValue({
      jti: 'old-jti',
      family_id: 'family-1',
      user_id: 14,
      expires_at: expiresAt,
      revoked_at: null,
      replaced_by_jti: null,
    });
    jest.spyOn(service as any, 'issueTokenPair').mockResolvedValue({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
      refreshJti: 'next-jti',
    });

    await expect(service.refreshToken('old-refresh')).resolves.toEqual({
      success: 'success',
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    });
    expect(refreshSessions.save).toHaveBeenCalledWith(
      expect.objectContaining({
        revoked_at: expect.any(Date),
        replaced_by_jti: 'next-jti',
      }),
    );
  });

  it('revokes an active family when a rotated token is reused', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 14,
      email: 'user@example.com',
      role: 'member',
      jti: 'used-jti',
      familyId: 'family-1',
      tokenUse: 'refresh',
    });
    usersService.getUserOrganizationsById.mockResolvedValue([]);
    refreshSessions.findOne.mockResolvedValue({
      jti: 'used-jti',
      family_id: 'family-1',
      user_id: 14,
      expires_at: new Date(Date.now() + 60_000),
      revoked_at: new Date(),
    });

    await expect(service.refreshToken('reused-refresh')).rejects.toThrow(
      'Invalid refresh token',
    );
    expect(refreshSessions.update).toHaveBeenCalledWith(
      expect.objectContaining({ family_id: 'family-1' }),
      expect.objectContaining({
        revoked_at: expect.any(Date),
        reuse_detected_at: expect.any(Date),
      }),
    );
  });
});
