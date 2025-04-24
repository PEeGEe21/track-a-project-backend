import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  OneToMany,
  JoinColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';
import { Task } from './Task';
import { ProjectPeer } from './ProjectPeers';
import { Tag } from './Tag';
import { Category } from './Category';

@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @ManyToMany(() => Tag)
  @JoinTable()
  tags?: Tag[];

  @ManyToMany(() => Category)
  @JoinTable()
  categories?: Category[];

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true}) // Added created_at column
  due_date: Date = new Date();

  //   @ManyToOne(() => User, (user) => user.posts)
  //   post_user: User;
  @ManyToMany(() => ProjectPeer, (projectPeer) => projectPeer.project)
  projectPeers: ProjectPeer[];

  @ManyToOne(() => User, (user) => user.projects)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
