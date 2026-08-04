import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { CustomFieldValue } from 'src/custom-fields/custom-field-type';
import { CustomFieldDefinition } from './CustomFieldDefinition';
import { Task } from './Task';

@Entity('task_custom_field_values')
@Unique('UQ_task_custom_field_value', ['task_id', 'definition_id'])
@Index('IDX_task_custom_field_definition', ['definition_id', 'task_id'])
export class TaskCustomFieldValue {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'int' }) task_id: number;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ type: 'uuid' }) definition_id: string;

  @ManyToOne(() => CustomFieldDefinition, (definition) => definition.values, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'definition_id' })
  definition: CustomFieldDefinition;

  @Column({ type: 'json' }) value: Exclude<CustomFieldValue, null>;

  @CreateDateColumn() created_at: Date;

  @UpdateDateColumn() updated_at: Date;
}
