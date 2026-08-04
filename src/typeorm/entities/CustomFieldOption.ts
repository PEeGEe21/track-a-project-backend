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
import { CustomFieldDefinition } from './CustomFieldDefinition';

@Entity('custom_field_options')
@Unique('UQ_custom_field_option_definition_key', ['definition_id', 'key'])
@Index('IDX_custom_field_option_list', [
  'definition_id',
  'archived_at',
  'position',
])
export class CustomFieldOption {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) definition_id: string;

  @ManyToOne(() => CustomFieldDefinition, (definition) => definition.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'definition_id' })
  definition: CustomFieldDefinition;

  @Column({ length: 80 }) key: string;

  @Column({ length: 120 }) label: string;

  @Column({ length: 32, nullable: true }) color: string | null;

  @Column({ type: 'int', unsigned: true, default: 0 }) position: number;

  @Column({ type: 'datetime', nullable: true }) archived_at: Date | null;

  @CreateDateColumn() created_at: Date;

  @UpdateDateColumn() updated_at: Date;
}
