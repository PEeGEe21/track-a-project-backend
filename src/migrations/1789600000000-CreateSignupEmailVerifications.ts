import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSignupEmailVerifications1789600000000
  implements MigrationInterface
{
  name = 'CreateSignupEmailVerifications1789600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `signup_email_verifications` (`id` varchar(36) NOT NULL, `email` varchar(320) NOT NULL, `code_hash` varchar(64) NOT NULL, `code_expires_at` datetime NOT NULL, `attempt_count` int NOT NULL DEFAULT 0, `resend_count` int NOT NULL DEFAULT 0, `last_sent_at` datetime NOT NULL, `proof_hash` varchar(64) NULL, `proof_expires_at` datetime NULL, `verified_at` datetime NULL, `consumed_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_signup_email_verifications_email` (`email`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `signup_email_verifications`');
  }
}
