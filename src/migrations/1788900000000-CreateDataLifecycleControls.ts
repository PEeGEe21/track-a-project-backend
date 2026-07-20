import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDataLifecycleControls1788900000000
  implements MigrationInterface
{
  name = 'CreateDataLifecycleControls1788900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`data_lifecycle_events\` (\`id\` varchar(36) NOT NULL, \`organization_id\` varchar(36) NOT NULL, \`actor_id\` bigint NOT NULL, \`record_type\` varchar(40) NOT NULL, \`record_id\` varchar(64) NOT NULL, \`action\` varchar(32) NOT NULL, \`metadata\` json NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_lifecycle_record\` (\`organization_id\`, \`record_type\`, \`record_id\`), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_lifecycle_org\` FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\`(\`id\`) ON DELETE CASCADE, CONSTRAINT \`FK_lifecycle_actor\` FOREIGN KEY (\`actor_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      'ALTER TABLE `notes` ADD COLUMN `audio_consent_at` datetime NULL, ADD COLUMN `audio_consent_by_id` bigint NULL, ADD COLUMN `audio_notice_version` varchar(32) NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `notes` DROP COLUMN `audio_notice_version`, DROP COLUMN `audio_consent_by_id`, DROP COLUMN `audio_consent_at`',
    );
    await queryRunner.query('DROP TABLE `data_lifecycle_events`');
  }
}
