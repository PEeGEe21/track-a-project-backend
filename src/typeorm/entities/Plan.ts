// src/billing/entities/plan.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Price } from './Price';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  code: string; // 'free', 'basic', 'pro', 'enterprise'

  @Column({ length: 100 })
  name: string; // "Free", "Basic", "Pro", "Enterprise"

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: false })
  is_public: boolean; // visible on pricing page?

  @Column({ default: true })
  is_active: boolean;

  // Useful for future sorting / comparison tables
  @Column({ type: 'int', default: 0 })
  display_order: number;

  @OneToMany(() => Price, (price) => price.plan, { cascade: true })
  prices: Price[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
