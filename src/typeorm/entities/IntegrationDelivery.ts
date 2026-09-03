import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const INTEGRATION_DELIVERY_STATES = [
  'queued',
  'sending',
  'succeeded',
  'dead_letter',
  'cancelled',
] as const;
export type IntegrationDeliveryState =
  (typeof INTEGRATION_DELIVERY_STATES)[number];

@Entity('integration_deliveries')
@Index(
  'UQ_integration_delivery_generation',
  ['endpoint_id', 'audit_event_id', 'generation'],
  { unique: true },
)
@Index('IDX_integration_delivery_worker', ['state', 'next_attempt_at'])
@Index('IDX_integration_delivery_org_created', [
  'organization_id',
  'created_at',
])
export class IntegrationDelivery {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organization_id: string;
  @Column({ type: 'int', nullable: true }) project_id: number | null;
  @Column({ type: 'uuid' }) endpoint_id: string;
  @Column({ type: 'uuid' }) audit_event_id: string;
  @Column({ type: 'int', unsigned: true, default: 1 }) generation: number;
  @Column({ type: 'varchar', length: 20, default: 'queued' })
  state: IntegrationDeliveryState;
  @Column({ type: 'int', unsigned: true, default: 0 }) attempt_count: number;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  next_attempt_at: Date | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  lease_expires_at: Date | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) failure_code:
    | string
    | null;
  @Column({ type: 'bigint', nullable: true }) replayed_by_user_id:
    | number
    | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) replay_reason:
    | string
    | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  completed_at: Date | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 6 }) updated_at: Date;
}
