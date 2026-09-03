import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('integration_delivery_attempts')
@Index('UQ_integration_attempt_number', ['delivery_id', 'attempt_number'], {
  unique: true,
})
export class IntegrationDeliveryAttempt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) delivery_id: string;
  @Column({ type: 'int', unsigned: true }) attempt_number: number;
  @Column({ type: 'varchar', length: 20 }) outcome: string;
  @Column({ type: 'int', unsigned: true, nullable: true }) status_code:
    | number
    | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) error_code:
    | string
    | null;
  @Column({ type: 'int', unsigned: true, nullable: true }) duration_ms:
    | number
    | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  next_attempt_at: Date | null;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) created_at: Date;
}
