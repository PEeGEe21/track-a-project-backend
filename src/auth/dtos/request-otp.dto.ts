import { IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  @IsPhoneNumber()
  phoneNumber: string;
}
