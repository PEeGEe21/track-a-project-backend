import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
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

@Controller('/auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(private authService: AuthService) {}

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
  async switchOrganization(
    @Req() req: any,
    @Body('organizationId') organizationId: string,
  ) {
    return this.authService.switchOrganization(req.user, organizationId);
  }

  /**
   * POST /auth/login
   * Login endpoint
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
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
  @Throttle({
    default: {
      limit: config.rateLimit.inviteMax,
      ttl: config.rateLimit.inviteWindowMs,
    },
  })
  async validateInvitation(@Query('token') token: string) {
    return this.authService.validateInvitation(token);
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
  @Throttle({
    default: {
      limit: config.rateLimit.defaultMax,
      ttl: config.rateLimit.defaultWindowMs,
    },
  })
  async refresh(@Query('refreshToken') refreshToken: string): Promise<any> {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('/logout')
  async logout(@Body('refreshToken') refreshToken: string): Promise<any> {
    return this.authService.logOut(refreshToken);
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
