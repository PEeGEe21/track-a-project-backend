import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';
import { ReusableTemplate } from './ReusableTemplate';
@Entity('reusable_template_versions')
@Index('UQ_reusable_template_version', ['template_id', 'version_number'], {
  unique: true,
})
export class ReusableTemplateVersion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) template_id: string;
  @ManyToOne(() => ReusableTemplate, (t) => t.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: ReusableTemplate;
  @Column({ type: 'int', unsigned: true }) version_number: number;
  @Column({ type: 'json' }) snapshot: Record<string, unknown>;
  @Column({ type: 'bigint' }) created_by_id: number;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;
  @CreateDateColumn() created_at: Date;
}
