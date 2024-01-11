import { IsPhoneNumber, IsString, MaxLength, MinLength, IsEmail } from 'class-validator';

export class RequestEmailOtpDto {
  @IsEmail()
  email: string;
}
