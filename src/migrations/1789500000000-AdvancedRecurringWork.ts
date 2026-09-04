import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedRecurringWork1789500000000 implements MigrationInterface {
  name = 'AdvancedRecurringWork1789500000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      "ALTER TABLE `task_recurrences` ADD `advanced_enabled` tinyint NOT NULL DEFAULT 0, ADD `holiday_policy` enum('none','skip','next_business_day') NOT NULL DEFAULT 'none', ADD `holiday_dates` json NULL, ADD `assignee_rotation_ids` json NULL, ADD `rotation_index` int NOT NULL DEFAULT 0, ADD `last_error_code` varchar(80) NULL, ADD `consecutive_failures` int NOT NULL DEFAULT 0, ADD `pending_changes` json NULL, ADD `changes_effective_at` datetime NULL",
    );
    await q.query(
      'ALTER TABLE `task_recurrence_occurrences` DROP FOREIGN KEY `FK_occurrence_task`',
    );
    await q.query(
      "ALTER TABLE `task_recurrence_occurrences` MODIFY `task_id` int NULL, ADD `outcome` varchar(20) NOT NULL DEFAULT 'generated', ADD `failure_code` varchar(80) NULL, ADD `resolved_due_at` datetime NULL",
    );
    await q.query(
      'ALTER TABLE `task_recurrence_occurrences` ADD CONSTRAINT `FK_recurrence_occurrence_task` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE SET NULL',
    );
    await q.query(
      'CREATE TABLE `task_recurrence_exceptions` (`id` int NOT NULL AUTO_INCREMENT, `recurrence_id` int NOT NULL, `scheduled_due_at` datetime NOT NULL, `action` varchar(20) NOT NULL, `rescheduled_due_at` datetime NULL, `reason` varchar(240) NULL, `created_by_id` int NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `IDX_recurrence_exception_schedule` (`recurrence_id`,`scheduled_due_at`), PRIMARY KEY (`id`), CONSTRAINT `FK_recurrence_exception_rule` FOREIGN KEY (`recurrence_id`) REFERENCES `task_recurrences`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `task_recurrence_exceptions`');
    await q.query(
      'ALTER TABLE `task_recurrence_occurrences` DROP FOREIGN KEY `FK_recurrence_occurrence_task`',
    );
    await q.query(
      'ALTER TABLE `task_recurrence_occurrences` DROP COLUMN `resolved_due_at`, DROP COLUMN `failure_code`, DROP COLUMN `outcome`',
    );
    await q.query(
      'ALTER TABLE `task_recurrence_occurrences` ADD CONSTRAINT `FK_occurrence_task` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE',
    );
    await q.query(
      'ALTER TABLE `task_recurrences` DROP COLUMN `changes_effective_at`, DROP COLUMN `pending_changes`, DROP COLUMN `consecutive_failures`, DROP COLUMN `last_error_code`, DROP COLUMN `rotation_index`, DROP COLUMN `assignee_rotation_ids`, DROP COLUMN `holiday_dates`, DROP COLUMN `holiday_policy`, DROP COLUMN `advanced_enabled`',
    );
  }
}
