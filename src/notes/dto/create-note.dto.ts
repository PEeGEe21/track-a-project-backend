import { Task } from 'src/typeorm/entities/Task';
import { User } from 'src/typeorm/entities/User';

export class CreateNoteDto {
  note: string;
  color: string;
  is_pinned: boolean;
  position: { x: number; y: number };
  createdAt: Date;
  user: User;
  taskId?: number;
}
