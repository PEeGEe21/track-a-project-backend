import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'refresh_sessions' })
@Index('IDX_refresh_sessions_family_active', ['family_id', 'revoked_at'])
@Index('IDX_refresh_sessions_user', ['user_id'])
export class RefreshSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  jti: string;

  @Column({ type: 'varchar', length: 36 })
  family_id: string;

  @Column({ type: 'bigint' })
  user_id: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  organization_id: string | null;

  @Column({ type: 'datetime' })
  expires_at: Date;

  @Column({ type: 'datetime', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  replaced_by_jti: string | null;

  @Column({ type: 'datetime', nullable: true })
  reuse_detected_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
