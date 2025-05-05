export class CreateUserDto {
  fist_name?: string;
  last_name?: string;
  email: string;
  password: string;
  inviteCode?: string;
}
