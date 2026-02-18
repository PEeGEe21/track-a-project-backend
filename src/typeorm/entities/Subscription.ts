// src/billing/entities/subscription.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Organization } from './Organization';
import { Price } from './Price';
import { SubscriptionStatus } from 'src/utils/constants/subscriptionStatusEnums';

@Entity('subscriptions')
@Index(['organization_id', 'status'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => Organization, (org) => org.subscriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'uuid', nullable: true })
  price_id: string | null;

  @ManyToOne(() => Price, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'price_id' })
  price: Price | null;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.INCOMPLETE,
  })
  status: SubscriptionStatus;

  @Column({ type: 'timestamp', nullable: true })
  current_period_start: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  current_period_end: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  trial_end: Date | null;

  @Column({ default: false })
  cancel_at_period_end: boolean;

  @Column({ type: 'timestamp', nullable: true })
  canceled_at: Date | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  // Synced limits — denormalized for fast reads & historical consistency
  @Column({ type: 'int', default: 5 })
  max_users: number;

  @Column({ type: 'int', default: 10 })
  max_projects: number;

  // Future Stripe placeholders
  @Column({ length: 100, nullable: true })
  stripe_subscription_id: string | null;

  @Column({ length: 100, nullable: true })
  stripe_customer_id: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
