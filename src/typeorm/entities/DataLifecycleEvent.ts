import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum LifecycleRecordType {
  DECISION = 'decision',
  NOTE_AUDIO = 'note_audio',
}

@Entity('data_lifecycle_events')
@Index(['organization_id', 'record_type', 'record_id'])
export class DataLifecycleEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'bigint' }) actor_id: number;
  @Column({ type: 'varchar', length: 40 }) record_type: LifecycleRecordType;
  @Column({ type: 'varchar', length: 64 }) record_id: string;
  @Column({ type: 'varchar', length: 32 }) action:
    | 'exported'
    | 'deleted'
    | 'consented'
    | 'accessed';
  // Operational facts only. Raw record content is forbidden here.
  @Column({ type: 'json', nullable: true }) metadata: Record<
    string,
    string | number | boolean | null
  > | null;
  @CreateDateColumn() created_at: Date;
}
