import { Task } from "../typeorm/entities/Task";
import { User } from "../typeorm/entities/User";

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

  
  export type CreateUserPostParams = {
    title: string;
    description: string;
  };