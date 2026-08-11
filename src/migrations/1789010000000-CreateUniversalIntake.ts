import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUniversalIntake1789010000000 implements MigrationInterface {
  name = 'CreateUniversalIntake1789010000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `intake_events` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `project_id` int NOT NULL, `task_id` int NULL, `channel` enum ('api','sdk','csv','excel','webhook','email','form') NOT NULL, `source_key` varchar(180) NOT NULL, `idempotency_key` varchar(255) NOT NULL, `state` enum ('received','validated','accepted','rejected','quarantined','failed') NOT NULL DEFAULT 'received', `normalized_payload` json NOT NULL, `validation_snapshot` json NULL, `task_dedupe_key` varchar(255) NULL, `failure_code` varchar(80) NULL, `failure_message` text NULL, `retryable` tinyint NOT NULL DEFAULT 0, `received_at` datetime NOT NULL, `processed_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_intake_event_idempotency` (`organization_id`,`channel`,`source_key`,`idempotency_key`), INDEX `IDX_intake_events_project_created` (`project_id`,`created_at`), INDEX `IDX_intake_events_project_state` (`project_id`,`state`), PRIMARY KEY (`id`), CONSTRAINT `FK_intake_events_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_intake_events_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_intake_events_task` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE SET NULL) ENGINE=InnoDB",
    );
    await queryRunner.query(
      "CREATE TABLE `intake_event_attempts` (`id` varchar(36) NOT NULL, `event_id` varchar(36) NOT NULL, `attempt_number` int UNSIGNED NOT NULL, `trigger` enum ('initial','automatic_retry','manual_retry','reprocess') NOT NULL, `state` enum ('processing','succeeded','failed') NOT NULL, `diagnostic_snapshot` json NULL, `started_at` datetime(6) NOT NULL, `completed_at` datetime(6) NULL, UNIQUE INDEX `UQ_intake_event_attempt_number` (`event_id`,`attempt_number`), PRIMARY KEY (`id`), CONSTRAINT `FK_intake_event_attempts_event` FOREIGN KEY (`event_id`) REFERENCES `intake_events`(`id`) ON DELETE CASCADE) ENGINE=InnoDB",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `intake_event_attempts`');
    await queryRunner.query('DROP TABLE `intake_events`');
  }
}
