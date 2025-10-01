import { Task } from "src/typeorm/entities/Task";
import { User } from "src/typeorm/entities/User";

export class CreateNoteDto {
  note: string;
  createdAt: Date;
  user: User;
  taskId?: number;
}
