import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { User } from './User';
import { IntakeImportRow } from './IntakeImportRow';

export type IntakeImportState =
  | 'previewed'
  | 'processing'
  | 'completed'
  | 'failed';

@Entity('intake_import_batches')
@Index('IDX_intake_import_batches_project_created', [
  'project_id',
  'created_at',
])
export class IntakeImportBatch {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
  @Column() project_id: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;
  @Column({ type: 'bigint' }) created_by_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;
  @Column({ type: 'enum', enum: ['csv', 'excel'] }) channel: 'csv' | 'excel';
  @Column({ length: 255 }) original_name: string;
  @Column({ length: 120, nullable: true }) sheet_name: string | null;
  @Column({
    type: 'enum',
    enum: ['previewed', 'processing', 'completed', 'failed'],
    default: 'previewed',
  })
  state: IntakeImportState;
  @Column({ type: 'json' }) headers: string[];
  @Column({ type: 'json', nullable: true }) mapping: Record<
    string,
    unknown
  > | null;
  @Column({ unsigned: true, default: 0 }) total_rows: number;
  @Column({ unsigned: true, default: 0 }) accepted_rows: number;
  @Column({ unsigned: true, default: 0 }) rejected_rows: number;
  @Column({ unsigned: true, default: 0 }) failed_rows: number;
  @OneToMany(() => IntakeImportRow, (row) => row.batch) rows: IntakeImportRow[];
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
