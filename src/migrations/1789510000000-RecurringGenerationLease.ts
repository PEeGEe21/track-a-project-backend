import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecurringGenerationLease1789510000000
  implements MigrationInterface
{
  name = 'RecurringGenerationLease1789510000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE `task_recurrences` ADD `generation_lease_until` datetime(6) NULL',
    );
    await q.query(
      'CREATE INDEX `IDX_recurrence_generation_lease` ON `task_recurrences` (`active`,`next_generation_at`,`generation_lease_until`)',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DROP INDEX `IDX_recurrence_generation_lease` ON `task_recurrences`',
    );
    await q.query(
      'ALTER TABLE `task_recurrences` DROP COLUMN `generation_lease_until`',
    );
  }
}
