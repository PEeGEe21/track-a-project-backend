import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskSeverity1786000000000 implements MigrationInterface {
  name = 'AddTaskSeverity1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `tasks` ADD `severity` varchar(32) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `tasks` DROP COLUMN `severity`');
  }
}
