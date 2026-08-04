import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  CustomFieldType,
  CustomFieldValue,
} from 'src/custom-fields/custom-field-type';
import { Project } from './Project';
import { User } from './User';
import { CustomFieldOption } from './CustomFieldOption';
import { TaskCustomFieldValue } from './TaskCustomFieldValue';

@Entity('custom_field_definitions')
@Unique('UQ_custom_field_definition_project_key', ['project_id', 'key'])
@Index('IDX_custom_field_definition_list', [
  'organization_id',
  'project_id',
  'archived_at',
  'position',
])
export class CustomFieldDefinition {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) organization_id: string;

  @Column({ type: 'int' }) project_id: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ length: 80 }) key: string;

  @Column({ length: 120 }) name: string;

  @Column({ type: 'text', nullable: true }) description: string | null;

  @Column({ type: 'enum', enum: CustomFieldType }) type: CustomFieldType;

  @Column({ type: 'boolean', default: false }) required: boolean;

  @Column({ type: 'int', unsigned: true, default: 0 }) position: number;

  @Column({ type: 'json', nullable: true }) default_value: CustomFieldValue;

  @Column({ type: 'datetime', nullable: true }) archived_at: Date | null;

  @Column({ type: 'bigint' }) created_by_id: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;

  @OneToMany(() => CustomFieldOption, (option) => option.definition)
  options: CustomFieldOption[];

  @OneToMany(() => TaskCustomFieldValue, (value) => value.definition)
  values: TaskCustomFieldValue[];

  @CreateDateColumn() created_at: Date;

  @UpdateDateColumn() updated_at: Date;
}
