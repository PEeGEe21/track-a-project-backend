import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIntakeImports1789020000000 implements MigrationInterface {
  name = 'CreateIntakeImports1789020000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `intake_import_batches` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `project_id` int NOT NULL, `created_by_id` bigint NOT NULL, `channel` enum ('csv','excel') NOT NULL, `original_name` varchar(255) NOT NULL, `sheet_name` varchar(120) NULL, `state` enum ('previewed','processing','completed','failed') NOT NULL DEFAULT 'previewed', `headers` json NOT NULL, `mapping` json NULL, `total_rows` int UNSIGNED NOT NULL DEFAULT 0, `accepted_rows` int UNSIGNED NOT NULL DEFAULT 0, `rejected_rows` int UNSIGNED NOT NULL DEFAULT 0, `failed_rows` int UNSIGNED NOT NULL DEFAULT 0, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `IDX_intake_import_batches_project_created` (`project_id`,`created_at`), PRIMARY KEY (`id`), CONSTRAINT `FK_intake_import_batch_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_intake_import_batch_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_intake_import_batch_user` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB",
    );
    await queryRunner.query(
      "CREATE TABLE `intake_import_rows` (`id` varchar(36) NOT NULL, `batch_id` varchar(36) NOT NULL, `row_number` int UNSIGNED NOT NULL, `source_values` json NOT NULL, `state` enum ('pending','accepted','rejected','failed') NOT NULL DEFAULT 'pending', `event_id` varchar(36) NULL, `error_code` varchar(80) NULL, `error_message` text NULL, UNIQUE INDEX `UQ_intake_import_row_number` (`batch_id`,`row_number`), PRIMARY KEY (`id`), CONSTRAINT `FK_intake_import_row_batch` FOREIGN KEY (`batch_id`) REFERENCES `intake_import_batches`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_intake_import_row_event` FOREIGN KEY (`event_id`) REFERENCES `intake_events`(`id`) ON DELETE SET NULL) ENGINE=InnoDB",
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `intake_import_rows`');
    await queryRunner.query('DROP TABLE `intake_import_batches`');
  }
}
