import {
  IsEmail,
  IsIn,
  IsLowercase,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class EmailLoginDto {
  @IsEmail()
  // @IsLowercase()
  email: string;

  password: string;

}
