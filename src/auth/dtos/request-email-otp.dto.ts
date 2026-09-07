import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RequestEmailOtpDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email: string;
}
