import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('integration_publisher_checkpoints')
export class IntegrationPublisherCheckpoint {
  @PrimaryColumn({ type: 'varchar', length: 80 }) publisher: string;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  occurred_at: Date | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) event_id:
    | string
    | null;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
