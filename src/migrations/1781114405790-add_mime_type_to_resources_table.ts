import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMimeTypeToResourcesTable1781114405790
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE resources
      ADD COLUMN mime_type varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE resources
      DROP COLUMN mime_type
    `);
  }
}
