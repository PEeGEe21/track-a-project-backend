import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { config } from '../../config';
import { EmailLoginDto } from '../dtos/email-login.dto';
import { LoginResponseDto } from '../dtos/login-response.dto';
import { PasswordResetWithCodeDto } from '../dtos/password-reset-with-code.dto';
import { PasswordResetDto } from '../dtos/password-reset.dto';
import { RequestOtpDto } from '../dtos/request-otp.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import { SignUpResponseDto } from '../dtos/signup-response.dto';

const testt = [];

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

  @Post('/login-email')
  async loginWithEmail(
    @Body() loginDto: EmailLoginDto,
  ): Promise<LoginResponseDto> {
    return this.authService.loginWithEmail(loginDto);
  }

  @Post('/signup')
  async userSignup(
    @Body() userSignupDto: any,
  ): Promise<SignUpResponseDto> {
    return this.authService.signUp(userSignupDto);
  }




  // @Post('/tailor/signup-password')
  // async tailorSIgnUpPassword(
  //   @Body() tailorSignUpasswordpDto: TailorSignupPasswordDto,
  // ): Promise<TailorSignupPasswordResponseDto> {
  //   return this.authService.signupAsTailorPassword(tailorSignUpasswordpDto);
  // }

  // @Post('/embroiderer/signup')
  // async embroidererSignup(
  //   @Body() embroidererSignupDto: EmbroidererSignupDto,
  // ): Promise<Embroiderer> {
  //   return this.authService.signupAsEmbroiderer(embroidererSignupDto);
  // }

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

  // @Post('/change-tailor-password')
  // async resetTailorPassword(
  //   @Body() tailorPasswordChange: TailorPasswordChange,
  // ): Promise<boolean> {
  //   return this.authService.changeTailorPassword(tailorPasswordChange);
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

  @Post('/webhook')
  async webhook(@Body() body: any): Promise<any> {
    testt.push(body);
    return testt;
  }



  @Get('/facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookLogin(): Promise<any> {
    return HttpStatus.OK;
  }


}
