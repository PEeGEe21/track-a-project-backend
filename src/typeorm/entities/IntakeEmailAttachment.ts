import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IntakeEvent } from './IntakeEvent';
@Entity('intake_email_attachments')
export class IntakeEmailAttachment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) event_id: string;
  @ManyToOne(() => IntakeEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: IntakeEvent;
  @Column({ length: 255 }) original_name: string;
  @Column({ length: 255 }) storage_key: string;
  @Column({ length: 180 }) mime_type: string;
  @Column({ type: 'bigint', unsigned: true }) size_bytes: number;
  @Column({ length: 64 }) sha256: string;
  @Column({
    type: 'enum',
    enum: ['quarantined', 'accepted', 'rejected'],
    default: 'quarantined',
  })
  status: 'quarantined' | 'accepted' | 'rejected';
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
}
