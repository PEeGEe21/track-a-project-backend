import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Decision } from './Decision';
export enum DecisionLinkType {
  TASK = 'task',
  MESSAGE = 'message',
  NOTE = 'note',
  DOCUMENT = 'document',
  USER = 'user',
}
@Entity('decision_links')
export class DecisionLink {
  @PrimaryGeneratedColumn() id: number;
  @Column() decision_id: number;
  @ManyToOne(() => Decision, (decision) => decision.links, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'decision_id' })
  decision: Decision;
  @Column({ type: 'enum', enum: DecisionLinkType }) link_type: DecisionLinkType;
  @Column({ length: 64 }) link_id: string;
  @Column({ length: 255 }) snapshot_label: string;
}
