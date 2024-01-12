import { Project } from "src/typeorm/entities/Project";
import { User } from "src/typeorm/entities/User";

export class PeerSignupResponseDto {
    accessToken: string;
    user: User;
    message: string;
    project: Project;
    peer: User;
  }