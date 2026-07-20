import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSidebarProjectPinPlanLimit1788880000000
  implements MigrationInterface
{
  name = 'AddSidebarProjectPinPlanLimit1788880000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `plans` ADD `sidebar_project_pin_limit` int NULL DEFAULT 10',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `plans` DROP COLUMN `sidebar_project_pin_limit`',
    );
  }
}
