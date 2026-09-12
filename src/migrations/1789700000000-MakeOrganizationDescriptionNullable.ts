import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeOrganizationDescriptionNullable1789700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE organizations
      MODIFY COLUMN description LONGTEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE organizations
      SET description = ''
      WHERE description IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE organizations
      MODIFY COLUMN description LONGTEXT NOT NULL
    `);
  }
}
