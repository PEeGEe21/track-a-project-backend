import { User } from "src/typeorm/entities/User";

export class CreateUserProfileDto {
  phonenumber?: string;
  country?: string;
  state?: string;
  address?: string;
  profile_created: number;
  user: User;
}
