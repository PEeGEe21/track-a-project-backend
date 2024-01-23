import { Project } from 'src/typeorm/entities/Project';
import { Task } from '../typeorm/entities/Task';
import { User } from '../typeorm/entities/User';
import { Tag } from 'src/typeorm/entities/Tag';
import { Status } from 'src/typeorm/entities/Status';

export type CreateUserParams = {
  username: string;
  password: string;
};

export type UpdateUserParams = {
  username: string;
  password: string;
};

export type CreateUserProfileParams = {
  firstName: string;
  lastName: string;
  age: number;
  dob: string;
};

export type CreateProjectParams = {
  title: string;
  description: string;
  user: User;
  tasks: Task[];
};

export type CreateTaskParams = {
  title: string;
  description: string;
  priority: Boolean;
  dueDate: Date;
  createdAt: Date;
  project: Project;
  status?: Status;
  tags: Tag[];
};

export type CreateStatusParams = {
  title: string;
  description: string;
  createdAt: Date;
  tasks?: Task[];
};

export type CreateUserPostParams = {
  title: string;
  description: string;
};
