import { IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class ValidateOtpDto {
  @IsPhoneNumber()
  phoneNumber: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otp: string;
}
