import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateIntakeWebhooks1789030000000 implements MigrationInterface {
  name = 'CreateIntakeWebhooks1789030000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE `intake_webhook_sources` (`id` varchar(36) NOT NULL,`organization_id` varchar(36) NOT NULL,`project_id` int NOT NULL,`public_key` varchar(64) NOT NULL,`name` varchar(180) NOT NULL,`secret_ciphertext` text NOT NULL,`previous_secret_ciphertext` text NULL,`previous_secret_expires_at` datetime NULL,`mapping` json NOT NULL,`active` tinyint NOT NULL DEFAULT 1,`created_by_id` bigint NOT NULL,`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),UNIQUE INDEX `UQ_intake_webhook_public_key` (`public_key`),INDEX `IDX_intake_webhook_project_active` (`project_id`,`active`),PRIMARY KEY (`id`),CONSTRAINT `FK_intake_webhook_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_intake_webhook_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_intake_webhook_creator` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `intake_webhook_sources`');
  }
}
