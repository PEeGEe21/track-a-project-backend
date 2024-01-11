import { MinLength } from 'class-validator';

export class PasswordResetDto {
  @MinLength(8)
  oldPassword: string;

  @MinLength(8)
  newPassword: string;

  @MinLength(8)
  newPasswordConfirmation: string;
}
