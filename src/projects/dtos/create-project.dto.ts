import { Task } from "../../typeorm/entities/Task";

export class CreateProjectDto {
  title: string;
  description: string;
  tasks?: Task[];
}