import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveEmailFromUserProfiles1788300000000
  implements MigrationInterface
{
  name = 'RemoveEmailFromUserProfiles1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `user_profiles` DROP COLUMN `email`');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `user_profiles` ADD `email` varchar(255) NOT NULL DEFAULT ''",
    );
  }
}
