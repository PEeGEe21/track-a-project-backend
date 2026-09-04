import { MigrationInterface, QueryRunner } from 'typeorm';
export class AdvancedApprovals1789600000000 implements MigrationInterface {
  name = 'AdvancedApprovals1789600000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE `approval_requests` ADD `policy_snapshot` json NULL, ADD `current_stage` int NOT NULL DEFAULT 0, ADD `escalated_at` datetime NULL',
    );
    await q.query(
      'ALTER TABLE `approval_reviewers` ADD `stage_index` int NOT NULL DEFAULT 0, ADD `required` tinyint NOT NULL DEFAULT 1, ADD `delegated_from_id` bigint NULL',
    );
    await q.query(
      'ALTER TABLE `approval_responses` ADD `stage_index` int NOT NULL DEFAULT 0',
    );
    await q.query(
      'CREATE INDEX `IDX_approval_stage_inbox` ON `approval_reviewers` (`reviewer_id`,`stage_index`)',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DROP INDEX `IDX_approval_stage_inbox` ON `approval_reviewers`',
    );
    await q.query('ALTER TABLE `approval_responses` DROP COLUMN `stage_index`');
    await q.query(
      'ALTER TABLE `approval_reviewers` DROP COLUMN `delegated_from_id`, DROP COLUMN `required`, DROP COLUMN `stage_index`',
    );
    await q.query(
      'ALTER TABLE `approval_requests` DROP COLUMN `escalated_at`, DROP COLUMN `current_stage`, DROP COLUMN `policy_snapshot`',
    );
  }
}
