import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestFormApprovals1788970000000
  implements MigrationInterface
{
  name = 'AddRequestFormApprovals1788970000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `request_form_versions` ADD `requires_approval` tinyint NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      "ALTER TABLE `request_form_submissions` MODIFY `status` enum ('received','pending_review','accepted','rejected','quarantined','failed') NOT NULL",
    );
    await queryRunner.query(
      'ALTER TABLE `request_form_submissions` ADD `reviewed_by_id` bigint NULL, ADD `reviewed_at` datetime NULL, ADD `review_note` text NULL, ADD INDEX `IDX_request_form_submission_review` (`project_id`,`status`,`created_at`), ADD CONSTRAINT `FK_request_form_submission_reviewer` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `request_form_submissions` DROP FOREIGN KEY `FK_request_form_submission_reviewer`, DROP INDEX `IDX_request_form_submission_review`, DROP COLUMN `review_note`, DROP COLUMN `reviewed_at`, DROP COLUMN `reviewed_by_id`',
    );
    await queryRunner.query(
      "ALTER TABLE `request_form_submissions` MODIFY `status` enum ('received','accepted','rejected','quarantined','failed') NOT NULL",
    );
    await queryRunner.query(
      'ALTER TABLE `request_form_versions` DROP COLUMN `requires_approval`',
    );
  }
}
