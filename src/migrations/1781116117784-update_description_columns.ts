import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateDescriptionColumns1781116117784
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projects
      MODIFY COLUMN description LONGTEXT NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE tasks
      MODIFY COLUMN description LONGTEXT NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projects
      MODIFY COLUMN description VARCHAR(255) NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE tasks
      MODIFY COLUMN description VARCHAR(255) NOT NULL
    `);
  }
}
