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
import { AuditLog } from 'src/typeorm/entities/AuditLog';
import { MailingService } from 'src/utils/mailing/mailing.service';
import { OrganizationRole } from 'src/utils/constants/org_roles';

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
    verifyAsync: jest.fn(),
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
        { provide: getRepositoryToken(AuditLog), useValue: repoStub },
        { provide: JwtService, useValue: jwtService },
        { provide: MailingService, useValue: mailingService },
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
    jest.spyOn(service as any, 'generateToken').mockResolvedValue(tokens);

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
    expect((service as any).generateToken).toHaveBeenCalledWith(
      user,
      organization,
      OrganizationRole.ORG_ADMIN,
    );
  });
});
