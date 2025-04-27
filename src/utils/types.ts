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
  firstname?: string;
  lastname?: string;
  username?: string;
  email: string;
  phonenumber?: string;
  country?: string;
  state?: string;
  address?: string;
  profile_created: number;
  user: User
};

export type CreateProjectParams = {
  title: string;
  description: string;
  tasks?: Task[];
};

export type CreateTaskParams = {
  title: string;
  description: string;
  priority?: Number;
  dueDate?: Date;
  createdAt?: Date;
  project?: Project;
  status?: Status;
  tags?: Tag[];
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
