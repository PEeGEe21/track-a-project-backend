import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIngestionActivityTypes1787000000000
  implements MigrationInterface
{
  name = 'AddIngestionActivityTypes1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE project_activities
      MODIFY COLUMN activity_type ENUM(
        'comment',
        'task_created',
        'task_ingested',
        'task_updated',
        'task_completed',
        'task_deleted',
        'task_reopened_by_ingestion',
        'peer_added',
        'peer_removed',
        'resource_added',
        'resource_deleted',
        'status_change',
        'project_updated'
      ) NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE project_activities
      SET activity_type = 'task_created'
      WHERE activity_type IN ('task_ingested', 'task_reopened_by_ingestion')
    `);

    await queryRunner.query(`
      ALTER TABLE project_activities
      MODIFY COLUMN activity_type ENUM(
        'comment',
        'task_created',
        'task_updated',
        'task_completed',
        'task_deleted',
        'peer_added',
        'peer_removed',
        'resource_added',
        'resource_deleted',
        'status_change',
        'project_updated'
      ) NOT NULL
    `);
  }
}
