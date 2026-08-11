import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateIntakeEmail1789040000000 implements MigrationInterface {
  name = 'CreateIntakeEmail1789040000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE `intake_email_addresses` (`id` varchar(36) NOT NULL,`organization_id` varchar(36) NOT NULL,`project_id` int NOT NULL,`token` varchar(64) NOT NULL,`name` varchar(180) NOT NULL,`active` tinyint NOT NULL DEFAULT 1,`spam_threshold` decimal(5,2) NOT NULL DEFAULT 5,`created_by_id` bigint NOT NULL,`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),UNIQUE INDEX `UQ_intake_email_address_token` (`token`),INDEX `IDX_intake_email_project_active` (`project_id`,`active`),PRIMARY KEY (`id`),CONSTRAINT `FK_intake_email_address_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_intake_email_address_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_intake_email_address_creator` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB',
    );
    await q.query(
      "CREATE TABLE `intake_email_attachments` (`id` varchar(36) NOT NULL,`event_id` varchar(36) NOT NULL,`original_name` varchar(255) NOT NULL,`storage_key` varchar(255) NOT NULL,`mime_type` varchar(180) NOT NULL,`size_bytes` bigint UNSIGNED NOT NULL,`sha256` varchar(64) NOT NULL,`status` enum ('quarantined','accepted','rejected') NOT NULL DEFAULT 'quarantined',`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),PRIMARY KEY (`id`),CONSTRAINT `FK_intake_email_attachment_event` FOREIGN KEY (`event_id`) REFERENCES `intake_events`(`id`) ON DELETE CASCADE) ENGINE=InnoDB",
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `intake_email_attachments`');
    await q.query('DROP TABLE `intake_email_addresses`');
  }
}
