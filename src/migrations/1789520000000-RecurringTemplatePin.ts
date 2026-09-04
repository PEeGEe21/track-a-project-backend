import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecurringTemplatePin1789520000000 implements MigrationInterface {
  name = 'RecurringTemplatePin1789520000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE `task_recurrences` ADD `reusable_template_version_id` varchar(36) NULL',
    );
    await q.query(
      'CREATE INDEX `IDX_recurrence_template_version` ON `task_recurrences` (`reusable_template_version_id`)',
    );
    await q.query(
      'ALTER TABLE `task_recurrences` ADD CONSTRAINT `FK_recurrence_template_version` FOREIGN KEY (`reusable_template_version_id`) REFERENCES `reusable_template_versions`(`id`) ON DELETE SET NULL',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE `task_recurrences` DROP FOREIGN KEY `FK_recurrence_template_version`',
    );
    await q.query(
      'DROP INDEX `IDX_recurrence_template_version` ON `task_recurrences`',
    );
    await q.query(
      'ALTER TABLE `task_recurrences` DROP COLUMN `reusable_template_version_id`',
    );
  }
}
