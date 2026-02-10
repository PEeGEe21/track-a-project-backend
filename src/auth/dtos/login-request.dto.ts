import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class LoginRequestDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsUUID()
  @IsOptional()
  organization_id?: string;
}
