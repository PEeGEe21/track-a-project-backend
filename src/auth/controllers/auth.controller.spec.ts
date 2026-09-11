import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    login: jest.fn(),
    loginWithEmail: jest.fn(),
    impersonateUser: jest.fn(),
    validateInvitation: jest.fn(),
    signUp: jest.fn(),
    refreshToken: jest.fn(),
    logOut: jest.fn(),
    switchOrganization: jest.fn(),
    requestSignupEmailVerification: jest.fn(),
    verifySignupEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('delegates login to the auth service', async () => {
    const dto = { email: 'user@example.com', password: 'secret' };
    authService.login.mockResolvedValue({ accessToken: 'token' });

    await expect(controller.login(dto as any)).resolves.toEqual({
      accessToken: 'token',
    });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('delegates signup email verification without changing the email', async () => {
    authService.requestSignupEmailVerification.mockResolvedValue({
      success: true,
    });
    authService.verifySignupEmail.mockResolvedValue({
      success: true,
      verificationToken: 'proof',
    });

    await controller.requestSignupEmailVerification({
      email: 'new@example.com',
    });
    await controller.verifySignupEmail({
      email: 'new@example.com',
      code: '123456',
    });

    expect(authService.requestSignupEmailVerification).toHaveBeenCalledWith(
      'new@example.com',
    );
    expect(authService.verifySignupEmail).toHaveBeenCalledWith(
      'new@example.com',
      '123456',
    );
  });

  it('uses the authenticated admin user for impersonation', async () => {
    authService.impersonateUser.mockResolvedValue({
      accessToken: 'impersonated',
    });

    await expect(
      controller.impersonateUser(42, { user: { userId: 7 } }),
    ).resolves.toEqual({ accessToken: 'impersonated' });
    expect(authService.impersonateUser).toHaveBeenCalledWith(42, 7);
  });

  it('accepts refresh tokens in a mobile-safe request body', async () => {
    authService.refreshToken.mockResolvedValue({ accessToken: 'next' });

    await expect(
      controller.refreshMobile({ refreshToken: 'refresh-token' }),
    ).resolves.toEqual({ accessToken: 'next' });
    expect(authService.refreshToken).toHaveBeenCalledWith('refresh-token');
  });

  it('passes the active organization from the request body', async () => {
    authService.switchOrganization.mockResolvedValue({ success: true });

    await expect(
      controller.switchOrganization(
        { user: { userId: 7 } },
        { organizationId: '9f5a9c1c-7c91-4f6d-a6b2-e7ce08751a23' },
      ),
    ).resolves.toEqual({ success: true });
    expect(authService.switchOrganization).toHaveBeenCalledWith(
      { userId: 7 },
      '9f5a9c1c-7c91-4f6d-a6b2-e7ce08751a23',
    );
  });

  it('returns a simple secured webhook acknowledgement', async () => {
    await expect(controller.webhook({ event: 'test' })).resolves.toEqual({
      received: true,
      body: { event: 'test' },
    });
  });
});
