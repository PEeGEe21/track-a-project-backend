import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFirstSeenToIngestedEvents1788200000000
  implements MigrationInterface
{
  name = 'AddFirstSeenToIngestedEvents1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ingested_events
      ADD COLUMN first_seen_at DATETIME NULL
    `);

    await queryRunner.query(`
      UPDATE ingested_events
      SET first_seen_at = COALESCE(created_at, last_seen_at)
      WHERE first_seen_at IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ingested_events
      MODIFY COLUMN first_seen_at DATETIME NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ingested_events
      DROP COLUMN first_seen_at
    `);
  }
}
