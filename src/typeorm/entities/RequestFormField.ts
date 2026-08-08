import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CustomFieldDefinition } from './CustomFieldDefinition';
import { RequestFormVersion } from './RequestFormVersion';

export enum RequestFormInputType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  DATE = 'date',
  SINGLE_SELECT = 'single_select',
  MULTI_SELECT = 'multi_select',
  CHECKBOX = 'checkbox',
  PERSON = 'person',
  URL = 'url',
  EMAIL = 'email',
  FILE = 'file',
}
export enum RequestFormTargetType {
  STANDARD = 'standard',
  CUSTOM_FIELD = 'custom_field',
  SUBMISSION_ONLY = 'submission_only',
}

@Entity('request_form_fields')
@Index('UQ_request_form_field_key', ['version_id', 'key'], { unique: true })
@Index('IDX_request_form_field_order', ['version_id', 'position'])
export class RequestFormField {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) version_id: string;
  @ManyToOne(() => RequestFormVersion, (version) => version.fields, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'version_id' })
  version: RequestFormVersion;
  @Column({ type: 'varchar', length: 80 }) key: string;
  @Column({ type: 'varchar', length: 180 }) label: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'enum', enum: RequestFormInputType })
  input_type: RequestFormInputType;
  @Column({ type: 'enum', enum: RequestFormTargetType })
  target_type: RequestFormTargetType;
  @Column({ type: 'varchar', length: 64, nullable: true })
  standard_field: string | null;
  @Column({ type: 'uuid', nullable: true }) custom_field_id: string | null;
  @ManyToOne(() => CustomFieldDefinition, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'custom_field_id' })
  custom_field: CustomFieldDefinition | null;
  @Column({ default: false }) required: boolean;
  @Column({ type: 'int', unsigned: true, default: 0 }) position: number;
  @Column({ type: 'json', nullable: true }) options_snapshot: unknown;
  @Column({ type: 'json', nullable: true }) conditions: unknown;
  @Column({ type: 'json', nullable: true }) config: unknown;
}
