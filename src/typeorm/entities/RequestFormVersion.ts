import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Status } from './Status';
import { User } from './User';
import { RequestForm } from './RequestForm';
import { RequestFormField } from './RequestFormField';
import { RequestFormSubmission } from './RequestFormSubmission';

export enum RequestFormVersionState {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  RETIRED = 'retired',
}
export enum RequestFormVisibility {
  PUBLIC = 'public',
  ORGANIZATION = 'organization',
}

@Entity('request_form_versions')
@Index('UQ_request_form_version_number', ['form_id', 'version_number'], {
  unique: true,
})
@Index('IDX_request_form_version_state', ['form_id', 'state'])
export class RequestFormVersion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) form_id: string;
  @ManyToOne(() => RequestForm, (form) => form.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'form_id' })
  form: RequestForm;
  @Column({ type: 'int', unsigned: true }) version_number: number;
  @Column({ type: 'enum', enum: RequestFormVersionState })
  state: RequestFormVersionState;
  @Column({ type: 'varchar', length: 180 }) title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'enum', enum: RequestFormVisibility })
  visibility: RequestFormVisibility;
  @Column() destination_status_id: number;
  @ManyToOne(() => Status, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destination_status_id' })
  destination_status: Status;
  @Column({ type: 'text', nullable: true }) confirmation_text: string | null;
  @Column({ type: 'boolean', default: false }) requires_approval: boolean;
  @Column({ type: 'bigint', nullable: true }) created_by_id: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User | null;
  @Column({ type: 'bigint', nullable: true }) published_by_id: number | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'published_by_id' })
  published_by: User | null;
  @Column({ type: 'datetime', nullable: true }) published_at: Date | null;
  @OneToMany(() => RequestFormField, (field) => field.version)
  fields: RequestFormField[];
  @OneToMany(() => RequestFormSubmission, (submission) => submission.version)
  submissions: RequestFormSubmission[];
  @CreateDateColumn() created_at: Date;
}
