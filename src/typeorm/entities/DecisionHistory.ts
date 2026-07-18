import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Decision } from './Decision';
import { User } from './User';
@Entity('decision_history')
export class DecisionHistory {
  @PrimaryGeneratedColumn() id: number;
  @Column() decision_id: number;
  @ManyToOne(() => Decision, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'decision_id' })
  decision: Decision;
  @Column({ type: 'bigint' }) actor_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_id' })
  actor: User;
  @Column({ length: 32 }) action: string;
  @Column({ type: 'json' }) snapshot: Record<string, unknown>;
  @CreateDateColumn() created_at: Date;
}
