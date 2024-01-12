import { Tag } from "src/typeorm/entities/Tag";
import { Task } from "../../typeorm/entities/Task";
import { User } from "../../typeorm/entities/User";
import { Project } from "src/typeorm/entities/Project";

export class CreateTaskDto {
  title: string;
  description: string;
  priority: Boolean;
  dueDate: Date;
  createdAt: Date;
  project: Project;
  tags: Tag[];
}