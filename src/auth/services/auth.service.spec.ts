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
import * as bcrypt from 'bcryptjs';
import { SignupEmailVerification } from 'src/typeorm/entities/SignupEmailVerification';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    getUserOrganizationsById: jest.fn(),
    getUserAccountById: jest.fn(),
  };
  const projectsService = {};
  const userRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(async (value) => value),
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
  const mailingService = {
    sendSignupVerificationOtp: jest.fn(),
  };
  const signupEmailVerificationRepository = {
    create: jest.fn((value) => value),
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
  };
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
        {
          provide: getRepositoryToken(SignupEmailVerification),
          useValue: signupEmailVerificationRepository,
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

  it('returns an account-scoped session when the user has no memberships', async () => {
    const user = {
      id: 14,
      email: 'user@example.com',
      password: await bcrypt.hash('correct-password', 4),
      role: 'member',
      is_active: true,
      logged_in: false,
      user_organizations: [],
    };
    userRepository.findOne.mockResolvedValue(user);
    usersService.getUserOrganizationsById.mockResolvedValue([]);
    jest.spyOn(service as any, 'issueTokenPair').mockResolvedValue({
      accessToken: 'account-access',
      refreshToken: 'account-refresh',
      refreshJti: 'refresh-jti',
    });

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'correct-password',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        nextStep: 'create_or_join_organization',
        organizations: [],
        token: {
          accessToken: 'account-access',
          refreshToken: 'account-refresh',
        },
      }),
    );
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ logged_in: true }),
    );
    expect((service as any).issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ currentOrganizationId: null }),
    );
  });

  it('refuses to delete a workspace outside the active token scope', async () => {
    await expect(
      service.deleteWorkspaceForAccount(
        {
          userId: 14,
          email: 'user@example.com',
          role: 'member',
          currentOrganizationId: 'org_active',
        },
        'org_other',
        { confirmationName: 'Other workspace' },
      ),
    ).rejects.toThrow('Only the active workspace can be deleted');
  });

  it('issues a one-time signup proof after a valid email code', async () => {
    const verification = {
      email: 'new@example.com',
      code_hash: (service as any).hashSignupSecret('123456'),
      code_expires_at: new Date(Date.now() + 60_000),
      attempt_count: 0,
      consumed_at: null,
      proof_hash: null,
      proof_expires_at: null,
      verified_at: null,
    };
    signupEmailVerificationRepository.findOne.mockResolvedValue(verification);

    await expect(
      service.verifySignupEmail('NEW@example.com', '123456'),
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        verificationToken: expect.any(String),
      }),
    );
    expect(verification.attempt_count).toBe(1);
    expect(verification.verified_at).toEqual(expect.any(Date));
    expect(verification.proof_hash).toHaveLength(64);
  });

  it('directs an existing account to sign in instead of pretending to send a code', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 14,
      email: 'existing@example.com',
    });

    await expect(
      service.requestSignupEmailVerification(' Existing@example.com '),
    ).rejects.toThrow(
      'An account already exists for this email. Sign in instead.',
    );
    expect(mailingService.sendSignupVerificationOtp).not.toHaveBeenCalled();
  });

  it('counts invalid signup verification attempts without exposing details', async () => {
    const verification = {
      code_hash: (service as any).hashSignupSecret('123456'),
      code_expires_at: new Date(Date.now() + 60_000),
      attempt_count: 0,
      consumed_at: null,
    };
    signupEmailVerificationRepository.findOne.mockResolvedValue(verification);

    await expect(
      service.verifySignupEmail('new@example.com', '999999'),
    ).rejects.toThrow('Invalid or expired verification code');
    expect(verification.attempt_count).toBe(1);
    expect(signupEmailVerificationRepository.save).toHaveBeenCalledWith(
      verification,
    );
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
