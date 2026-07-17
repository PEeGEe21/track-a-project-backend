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
import { IngestedEvent } from './IngestedEvent';

@Entity({ name: 'tasks' })
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'longtext', nullable: true })
  description: string;

  @Column({ type: 'longtext', nullable: true })
  description_html: string | null;

  @Column({
    default: 0,
  })
  priority: number;

  @Column({ length: 32, nullable: true })
  severity: string | null;

  @Column({ default: 0 })
  position: number;

  @ManyToMany(() => Tag)
  @JoinTable()
  tags?: Tag[];

  @ManyToMany(() => Category)
  @JoinTable()
  categories?: Category[];

  @Column({ type: 'datetime', nullable: true })
  due_date: Date | null;

  @ManyToOne(() => Project, (project) => project.tasks, {
    onDelete: 'CASCADE',
  })
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

  @OneToMany(() => Resource, (resource) => resource.task)
  resources: Resource[];

  @OneToMany(() => IngestedEvent, (ingestedEvent) => ingestedEvent.task)
  ingestedEvents?: IngestedEvent[];

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;
}
