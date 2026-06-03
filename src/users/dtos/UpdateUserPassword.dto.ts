import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserPasswordDto {
  @IsString()
  @IsNotEmpty()
  new_password: string;

  @IsString()
  @IsNotEmpty()
  confirm_password: string;

  @IsString()
  @IsNotEmpty()
  current_password: string;
}
