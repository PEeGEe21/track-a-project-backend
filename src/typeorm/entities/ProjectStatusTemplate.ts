import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('project_status_templates')
export class ProjectStatusTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  color: string | null;

  @Column({ name: 'tab_id', default: 0 })
  tabId: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: true })
  isDefault: boolean;

  @Column({ default: false })
  isTerminal: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
