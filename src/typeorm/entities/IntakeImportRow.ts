import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IntakeEvent } from './IntakeEvent';
import { IntakeImportBatch } from './IntakeImportBatch';

@Entity('intake_import_rows')
@Index('UQ_intake_import_row_number', ['batch_id', 'row_number'], {
  unique: true,
})
export class IntakeImportRow {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) batch_id: string;
  @ManyToOne(() => IntakeImportBatch, (batch) => batch.rows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'batch_id' })
  batch: IntakeImportBatch;
  @Column({ unsigned: true }) row_number: number;
  @Column({ type: 'json' }) source_values: Record<string, unknown>;
  @Column({
    type: 'enum',
    enum: ['pending', 'accepted', 'rejected', 'failed'],
    default: 'pending',
  })
  state: 'pending' | 'accepted' | 'rejected' | 'failed';
  @Column({ type: 'uuid', nullable: true }) event_id: string | null;
  @ManyToOne(() => IntakeEvent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'event_id' })
  event: IntakeEvent | null;
  @Column({ length: 80, nullable: true }) error_code: string | null;
  @Column({ type: 'text', nullable: true }) error_message: string | null;
}
