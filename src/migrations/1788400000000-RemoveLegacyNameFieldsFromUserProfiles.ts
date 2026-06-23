import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveLegacyNameFieldsFromUserProfiles1788400000000
  implements MigrationInterface
{
  name = 'RemoveLegacyNameFieldsFromUserProfiles1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user_profiles` DROP COLUMN `firstname`',
    );
    await queryRunner.query(
      'ALTER TABLE `user_profiles` DROP COLUMN `lastname`',
    );
    await queryRunner.query(
      'ALTER TABLE `user_profiles` DROP COLUMN `username`',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `user_profiles` ADD `username` varchar(255) NOT NULL DEFAULT ''",
    );
    await queryRunner.query(
      "ALTER TABLE `user_profiles` ADD `lastname` varchar(255) NOT NULL DEFAULT ''",
    );
    await queryRunner.query(
      "ALTER TABLE `user_profiles` ADD `firstname` varchar(255) NOT NULL DEFAULT ''",
    );
  }
}
