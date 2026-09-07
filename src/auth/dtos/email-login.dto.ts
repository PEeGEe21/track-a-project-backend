import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class EmailLoginDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  // @IsLowercase()
  email: string;

  @ApiProperty({ format: 'password', minLength: 8, maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  password: string;
}
