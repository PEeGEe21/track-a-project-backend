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

  it('uses the authenticated admin user for impersonation', async () => {
    authService.impersonateUser.mockResolvedValue({ accessToken: 'impersonated' });

    await expect(
      controller.impersonateUser(42, { user: { userId: 7 } }),
    ).resolves.toEqual({ accessToken: 'impersonated' });
    expect(authService.impersonateUser).toHaveBeenCalledWith(42, 7);
  });

  it('returns a simple secured webhook acknowledgement', async () => {
    await expect(controller.webhook({ event: 'test' })).resolves.toEqual({
      received: true,
      body: { event: 'test' },
    });
  });
});
