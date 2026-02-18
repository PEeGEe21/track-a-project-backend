// src/billing/entities/price.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Plan } from './Plan';
import { PriceInterval } from 'src/utils/constants/priceIntervalEnums';

@Entity('prices')
export class Price {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  plan_id: string;

  @ManyToOne(() => Plan, (plan) => plan.prices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({ length: 100, nullable: true })
  stripe_price_id: string | null; // future placeholder

  @Column({
    type: 'enum',
    enum: PriceInterval,
    default: PriceInterval.MONTH,
  })
  interval: PriceInterval;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unit_amount: number; // 0, 12.00, 29.00, 199.00

  @Column({ length: 10, default: 'USD' })
  currency: string;

  // For seat-based pricing (later)
  @Column({ type: 'int', default: 1 })
  min_quantity: number;

  @Column({ type: 'int', nullable: true })
  max_quantity: number | null;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
