import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutomationEventDedupe1789070000000
  implements MigrationInterface
{
  name = 'AddAutomationEventDedupe1789070000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE `automation_events` ADD `dedupe_key` varchar(255) NULL AFTER `subject_id`, ADD UNIQUE INDEX `UQ_automation_event_dedupe` (`organization_id`,`event_type`,`dedupe_key`)',
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE `automation_events` DROP INDEX `UQ_automation_event_dedupe`, DROP COLUMN `dedupe_key`',
    );
  }
}
