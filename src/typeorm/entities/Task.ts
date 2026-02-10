import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './User';
import { Project } from './Project';
import { Tag } from './Tag';
import { Status } from './Status';
import { Category } from './Category';
import { Note } from './Note';
import { Resource } from './Resource';
import { Organization } from './Organization';

@Entity({ name: 'tasks' })
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({
    default: 0,
  })
  priority: number;

  @Column({ default: 0 })
  position: number;

  @ManyToMany(() => Tag)
  @JoinTable()
  tags?: Tag[];

  @ManyToMany(() => Category)
  @JoinTable()
  categories?: Category[];

  @Column()
  due_date: Date = new Date();

  @ManyToOne(() => Project, (project) => project.tasks)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Status, (status) => status.tasks)
  @JoinColumn({ name: 'status_id' })
  status: Status;

  @ManyToOne(() => User, (user) => user.projects)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Note, (note) => note.task, { cascade: true })
  notes: Note[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'task_assignees',
    joinColumn: { name: 'task_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  assignees?: User[];

  @OneToMany(() => Resource, (resource) => resource.project)
  resources: Resource[];

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;
}
