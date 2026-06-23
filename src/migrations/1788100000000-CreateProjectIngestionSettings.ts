import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectIngestionSettings1788100000000
  implements MigrationInterface
{
  name = 'CreateProjectIngestionSettings1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS project_ingestion_settings (
        id INT NOT NULL AUTO_INCREMENT,
        project_id INT NOT NULL,
        closed_task_dedupe_behavior ENUM('reopen', 'create_new', 'reopen_if_recent') NOT NULL DEFAULT 'reopen',
        reopen_if_recent_window_days INT NOT NULL DEFAULT 7,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_project_ingestion_settings_project_id (project_id),
        CONSTRAINT FK_project_ingestion_settings_project
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO project_ingestion_settings (
        project_id,
        closed_task_dedupe_behavior,
        reopen_if_recent_window_days
      )
      SELECT
        id,
        'reopen',
        7
      FROM projects
      WHERE id NOT IN (
        SELECT project_id FROM project_ingestion_settings
      )
    `);

    await queryRunner.query(`
      SET @has_column := (
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'projects'
          AND COLUMN_NAME = 'ingestion_closed_task_dedupe_behavior'
      )
    `);
    await queryRunner.query(`
      SET @drop_column_sql := IF(
        @has_column > 0,
        'ALTER TABLE projects DROP COLUMN ingestion_closed_task_dedupe_behavior',
        'SELECT 1'
      )
    `);
    await queryRunner.query(`PREPARE stmt FROM @drop_column_sql`);
    await queryRunner.query(`EXECUTE stmt`);
    await queryRunner.query(`DEALLOCATE PREPARE stmt`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projects
      ADD COLUMN ingestion_closed_task_dedupe_behavior
      ENUM('reopen', 'create_new')
      NOT NULL DEFAULT 'reopen'
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS project_ingestion_settings
    `);
  }
}
