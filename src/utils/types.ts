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
  username?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
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
  user: User;
};

export type CreateProjectParams = {
  title: string;
  description: string;
  tasks?: Task[];
};

export type CreateTaskParams = {
  title: string;
  description: string;
  priority?: number;
  due_date?: Date;
  project?: Project;
  status?: Status;
  tags?: Tag[];
  assignees?: User[];
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

export type MailTemplateParams = {
  template: string;
  inviterEmail?: string;
  inviteLink?: string;
  inviterName?: string;
  project?: Project;
};

export enum ResourceType {
  LINK = 'link',
  FILE = 'file',
  TOOL = 'tool',
  DOCUMENT = 'document',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  OTHER = 'other',
}

export interface WhiteboardState {
  title?: string;
  whiteboardId?: string;
  elements: any[];
  appState: any;
  files: any;
}

export enum UserOrderBy {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
