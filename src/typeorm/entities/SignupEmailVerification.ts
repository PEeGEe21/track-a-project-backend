import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'signup_email_verifications' })
@Index('UQ_signup_email_verifications_email', ['email'], { unique: true })
export class SignupEmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ type: 'varchar', length: 64 })
  code_hash: string;

  @Column({ type: 'datetime' })
  code_expires_at: Date;

  @Column({ type: 'int', default: 0 })
  attempt_count: number;

  @Column({ type: 'int', default: 0 })
  resend_count: number;

  @Column({ type: 'datetime' })
  last_sent_at: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  proof_hash: string | null;

  @Column({ type: 'datetime', nullable: true })
  proof_expires_at: Date | null;

  @Column({ type: 'datetime', nullable: true })
  verified_at: Date | null;

  @Column({ type: 'datetime', nullable: true })
  consumed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
