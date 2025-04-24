import { Task } from "../../typeorm/entities/Task";
import { User } from "../../typeorm/entities/User";

export class CreateProjectDto {
  title: string;
  description: string;
  user?: User;
  tasks?: Task[];
}