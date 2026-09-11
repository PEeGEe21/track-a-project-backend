import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { EmailLoginDto } from '../dtos/email-login.dto';
import { LoginResponseDto } from '../dtos/login-response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import { SignUpResponseDto } from '../dtos/signup-response.dto';
import { CreateOrganizationDto } from 'src/organizations/dto/create-organization.dto';
import { JoinOrganizationDto } from 'src/organizations/dto/join-organization.dto';
import { LoginRequestDto } from '../dtos/login-request.dto';
import { SuperAdminGuard } from 'src/common/guards/super-admin.guard';
import { CreateUserDto } from '../dtos/create-user.dto';
import { Throttle } from '@nestjs/throttler';
import { config } from 'src/config';
import { RequestEmailOtpDto } from '../dtos/request-email-otp.dto';
import { VerifyForgotPasswordOtpDto } from '../dtos/verify-forgot-password-otp.dto';
import { ResetPasswordEmailDto } from '../dtos/reset-password-email.dto';
import {
  AuthenticatedSessionResponseDto,
  InvitationValidationResponseDto,
  OrganizationSelectionResponseDto,
  RefreshTokenRequestDto,
  RefreshTokenResponseDto,
  SignupSessionResponseDto,
  SwitchOrganizationRequestDto,
  SwitchOrganizationResponseDto,
  SignupVerificationResponseDto,
  WorkspaceRequiredResponseDto,
} from '../dtos/auth-contract.dto';
import { VerifySignupEmailDto } from '../dtos/verify-signup-email.dto';
import {
  ApiErrorDto,
  ApiStandardErrors,
  MessageResponseDto,
} from 'src/common/openapi/api-contract.dto';

@Controller('/auth')
@ApiTags('Authentication')
@ApiExtraModels(
  ApiErrorDto,
  AuthenticatedSessionResponseDto,
  OrganizationSelectionResponseDto,
  WorkspaceRequiredResponseDto,
)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup/request-email-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request or resend a signup email code' })
  @ApiOkResponse({ type: SignupVerificationResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.authMax,
      ttl: config.rateLimit.authWindowMs,
    },
  })
  requestSignupEmailVerification(
    @Body(ValidationPipe) dto: RequestEmailOtpDto,
  ) {
    return this.authService.requestSignupEmailVerification(dto.email);
  }

  @Post('signup/verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a signup email code' })
  @ApiOkResponse({ type: SignupVerificationResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.authMax,
      ttl: config.rateLimit.authWindowMs,
    },
  })
  verifySignupEmail(@Body(ValidationPipe) dto: VerifySignupEmailDto) {
    return this.authService.verifySignupEmail(dto.email, dto.code);
  }

  // @Post('/login-phone')
  // async loginWithPhoneNumber(
  //   @Body() loginDto: PhoneNumberLoginDto,
  // ): Promise<LoginResponseDto> {
  //   return this.authService.loginWithPhoneNumber(loginDto);
  // }

  /**
   * POST /auth/signup/create-organization
   * Sign up with new organization (becomes ORG_ADMIN)
   */
  @Post('signup/create-organization')
  @ApiOperation({ summary: 'Create an account and a new organization' })
  @ApiCreatedResponse({ type: SignupSessionResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.authMax,
      ttl: config.rateLimit.authWindowMs,
    },
  })
  async signUpWithOrganization(
    @Body(ValidationPipe) dto: CreateOrganizationDto,
  ) {
    return this.authService.signUpWithOrganization(dto);
  }

  /**
   * POST /auth/signup/join-organization
   * Sign up via invitation (joins existing organization)
   */
  @Post('signup/join-organization')
  @ApiOperation({ summary: 'Create an account through an invitation' })
  @ApiCreatedResponse({ type: SignupSessionResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.authMax,
      ttl: config.rateLimit.authWindowMs,
    },
  })
  async signUpWithInvitation(@Body(ValidationPipe) dto: JoinOrganizationDto) {
    return this.authService.signUpWithInvitation(dto);
  }

  // auth.controller.ts
  @Post('/switch-organization')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch the active organization' })
  @ApiCreatedResponse({ type: SwitchOrganizationResponseDto })
  @ApiStandardErrors({ forbidden: true })
  async switchOrganization(
    @Req() req: any,
    @Body(ValidationPipe) dto: SwitchOrganizationRequestDto,
  ) {
    return this.authService.switchOrganization(req.user, dto.organizationId);
  }

  /**
   * POST /auth/login
   * Login endpoint
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and select or discover an organization' })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AuthenticatedSessionResponseDto) },
        { $ref: getSchemaPath(OrganizationSelectionResponseDto) },
        { $ref: getSchemaPath(WorkspaceRequiredResponseDto) },
      ],
    },
  })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.authMax,
      ttl: config.rateLimit.authWindowMs,
    },
  })
  async login(@Body(ValidationPipe) dto: LoginRequestDto) {
    return this.authService.login(dto);
  }

  /**
   * GET /auth/validate-invitation?token=xxx
   * Validate invitation token before signup
   */
  @Get('validate-invitation')
  @ApiOperation({ summary: 'Validate an invitation before account creation' })
  @ApiQuery({ name: 'token', type: String, required: false })
  @ApiQuery({ name: 'code', type: String, required: false })
  @ApiOkResponse({ type: InvitationValidationResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.inviteMax,
      ttl: config.rateLimit.inviteWindowMs,
    },
  })
  async validateInvitation(
    @Query('token') token?: string,
    @Query('code') code?: string,
  ) {
    return this.authService.validateInvitation({
      invite_token: token,
      invite_code: code,
    });
  }
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Post('users/:id/impersonate')
  async impersonateUser(
    @Param('id', ParseIntPipe) userId: number,
    @Req() req: any,
  ) {
    return this.authService.impersonateUser(userId, req.user.userId);
  }

  @Post('/login-email')
  @ApiOperation({ summary: 'Legacy email sign in' })
  @ApiCreatedResponse({ type: LoginResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.authMax,
      ttl: config.rateLimit.authWindowMs,
    },
  })
  async loginWithEmail(
    @Body(ValidationPipe) loginDto: EmailLoginDto,
  ): Promise<LoginResponseDto> {
    return this.authService.loginWithEmail(loginDto);
  }

  @Post('/login-admin')
  @ApiOperation({ summary: 'Sign in to the administration portal' })
  @ApiCreatedResponse({ type: LoginResponseDto })
  @ApiStandardErrors({ forbidden: true })
  @Throttle({
    default: {
      limit: Math.max(3, Math.floor(config.rateLimit.authMax / 2)),
      ttl: config.rateLimit.authWindowMs,
    },
  })
  async loginWithAdmin(
    @Body(ValidationPipe) loginDto: EmailLoginDto,
  ): Promise<LoginResponseDto> {
    return this.authService.loginWithAdmin(loginDto);
  }

  @Post('/signup')
  @ApiOperation({ summary: 'Legacy account creation' })
  @ApiCreatedResponse({ type: SignUpResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.authMax,
      ttl: config.rateLimit.authWindowMs,
    },
  })
  async userSignup(
    @Body(ValidationPipe) userSignupDto: CreateUserDto,
  ): Promise<SignUpResponseDto> {
    return this.authService.signUp(userSignupDto);
  }

  @Get('/access-token')
  @ApiOperation({
    summary: 'Refresh tokens through the legacy query endpoint',
    deprecated: true,
  })
  @ApiQuery({ name: 'refreshToken', type: String })
  @ApiOkResponse({ type: RefreshTokenResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.defaultMax,
      ttl: config.rateLimit.defaultWindowMs,
    },
  })
  async refresh(@Query('refreshToken') refreshToken: string): Promise<any> {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access and refresh tokens',
    description:
      'Atomically consumes the supplied refresh token and returns a rotated pair. Reusing a consumed token revokes its session family.',
  })
  @ApiOkResponse({ type: RefreshTokenResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.defaultMax,
      ttl: config.rateLimit.defaultWindowMs,
    },
  })
  async refreshMobile(@Body(ValidationPipe) dto: RefreshTokenRequestDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invalidate the current session',
    description:
      'Revokes the refresh-token family for the current device session.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiStandardErrors()
  async logout(@Body(ValidationPipe) dto: RefreshTokenRequestDto) {
    return this.authService.logOut(dto.refreshToken);
  }

  @Post('/forgot-password')
  @ApiOperation({ summary: 'Request a password-reset verification code' })
  @ApiCreatedResponse({ type: MessageResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.authMax,
      ttl: config.rateLimit.authWindowMs,
    },
  })
  async forgotPassword(@Body(ValidationPipe) dto: RequestEmailOtpDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('/verify-forgot-password-otp')
  @ApiOperation({ summary: 'Verify a password-reset code' })
  @ApiCreatedResponse({ type: MessageResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.authMax,
      ttl: config.rateLimit.authWindowMs,
    },
  })
  async verifyForgotPasswordOtp(
    @Body(ValidationPipe) dto: VerifyForgotPasswordOtpDto,
  ) {
    return this.authService.verifyForgotPasswordOtp(dto.email, dto.otp);
  }

  @Patch('/reset-password')
  @ApiOperation({ summary: 'Set a new password after verification' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiStandardErrors()
  @Throttle({
    default: {
      limit: config.rateLimit.authMax,
      ttl: config.rateLimit.authWindowMs,
    },
  })
  async resetPassword(@Body(ValidationPipe) dto: ResetPasswordEmailDto) {
    return this.authService.resetPasswordWithEmail(dto.email, dto.password);
  }

  // @Post('/send-signup-otp')
  // async sendSignupOTP(@Body() otpDto: RequestOtpDto): Promise<boolean> {
  //   return this.authService.sendSignupOtp(otpDto);
  // }

  // @Post('/resend-signup-otp')
  // async resendSignupOTP(@Body() otpDto: RequestOtpDto): Promise<boolean> {
  //   return this.authService.resendSignupOtp(otpDto);
  // }

  // @Post('/passwordless-login')
  // async passwordlessLogin(
  //   @Body() loginDto: PasswordlessLoginDto,
  // ): Promise<LoginResponseDto> {
  //   return this.authService.passwordlessLogin(loginDto);
  // }

  // @UseGuards(JwtAuthGuard)
  // async resendEmailConfirmation(@Query() email: string): Promise<string> {
  //   return this.authService.sendConfirmationEmail(email);
  // }

  // async confirmEmail(
  //   @Query() confirmationCode: string,
  //   @Query() email: string,
  // ): Promise<boolean> {
  //   return this.authService.confirmEmail(confirmationCode, email);
  // }

  // @UseGuards(JwtAuthGuard)
  // async resetPassword(
  //   @LoggedInUser() user: UserAccount,
  //   @Body() passwordResetDto: PasswordResetDto,
  // ): Promise<void> {
  //   return this.authService.resetPassword(user, passwordResetDto);
  // }

  // @Post('/recover-password-with-code')
  // async resetPasswordWithVerificationCode(
  //   @Body() passwordResetWithCodeDto: PasswordResetWithCodeDto,
  // ): Promise<boolean> {
  //   return this.authService.resetPasswordWithRecoveryCode(
  //     passwordResetWithCodeDto,
  //   );
  // }

  // @Post('/recover-password')
  // async recoverPassword(
  //   @Req() req,
  //   @Query('email') email: string,
  // ): Promise<boolean> {
  //   const host = req.headers.origin;
  //   return this.authService.recoverPassword(email.toLowerCase(), host);
  // }

  // @Post('/verify-email')
  // async verifyEmail(
  //   @Query('confirmationCode') confirmationCode: string,
  // ): Promise<boolean> {
  //   return this.authService.verifyEmail(confirmationCode);
  // }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Post('/webhook')
  async webhook(@Body() body: any): Promise<any> {
    return {
      received: true,
      body,
    };
  }

  @Get('/facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookLogin(): Promise<any> {
    return HttpStatus.OK;
  }
}
