import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Post } from './typeorm/entities/Post';
import { Profile } from './typeorm/entities/Profile';
import { User } from './typeorm/entities/User';
import { Project } from './typeorm/entities/Project';
import { Task } from './typeorm/entities/Task';
import { Tag } from './typeorm/entities/Tag';
import { ProjectPeer } from './typeorm/entities/ProjectPeers';
import { Status } from './typeorm/entities/Status';
import { UserPeer } from './typeorm/entities/UserPeer';
import { Category } from './typeorm/entities/Category';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: false },
  synchronize: false, // or true for local dev
  entities: [
    User,
    Profile,
    Post,
    Project,
    Task,
    Tag,
    ProjectPeer,
    Status,
    UserPeer,
    Category,
  ],
});
