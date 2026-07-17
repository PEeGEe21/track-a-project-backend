import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLatestProjectUpdateVersion1788770000000 implements MigrationInterface {
  name = 'AddLatestProjectUpdateVersion1788770000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE project_updates ADD is_latest tinyint NOT NULL DEFAULT 1 AFTER version');
    await queryRunner.query('CREATE INDEX IDX_project_updates_latest ON project_updates (organization_id, project_id, status, is_latest, created_at)');
    await queryRunner.query(`UPDATE project_updates older INNER JOIN project_updates newer ON newer.series_id = older.series_id AND newer.version > older.version SET older.is_latest = 0`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IDX_project_updates_latest ON project_updates');
    await queryRunner.query('ALTER TABLE project_updates DROP COLUMN is_latest');
  }
}
