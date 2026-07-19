import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkConversionClaims1788860000000
  implements MigrationInterface
{
  name = 'CreateWorkConversionClaims1788860000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `work_conversion_claims` (`organization_id` varchar(36) NOT NULL, `source_type` varchar(32) NOT NULL, `source_key` varchar(255) NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (`organization_id`, `source_type`, `source_key`)) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'INSERT IGNORE INTO `work_conversion_claims` (`organization_id`, `source_type`, `source_key`, `created_at`) SELECT `organization_id`, `source_type`, `source_key`, MIN(`created_at`) FROM `work_conversions` GROUP BY `organization_id`, `source_type`, `source_key`',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `work_conversion_claims`');
  }
}
