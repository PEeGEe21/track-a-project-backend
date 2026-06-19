import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeTaskDueDateNullable1784000000000
  implements MigrationInterface
{
  name = 'MakeTaskDueDateNullable1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tasks
      MODIFY due_date datetime NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tasks
      SET due_date = NOW()
      WHERE due_date IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE tasks
      MODIFY due_date datetime NOT NULL
    `);
  }
}
