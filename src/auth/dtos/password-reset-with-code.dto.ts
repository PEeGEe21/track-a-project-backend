import { MinLength } from 'class-validator';

export class PasswordResetWithCodeDto {
  @MinLength(8)
  recoveryCode: string;

  @MinLength(8)
  newPassword: string;
}
