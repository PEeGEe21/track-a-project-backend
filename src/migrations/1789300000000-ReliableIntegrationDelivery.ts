import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReliableIntegrationDelivery1789300000000
  implements MigrationInterface
{
  name = 'ReliableIntegrationDelivery1789300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE `integration_endpoints` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `project_id` int NULL, `name` varchar(160) NOT NULL, `url` varchar(2048) NOT NULL, `actions` json NOT NULL, `secret_ciphertext` text NOT NULL, `previous_secret_ciphertext` text NULL, `previous_secret_expires_at` datetime(6) NULL, `active` tinyint NOT NULL DEFAULT 1, `created_by_user_id` bigint NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `IDX_integration_endpoint_org_active` (`organization_id`,`active`), INDEX `IDX_integration_endpoint_project` (`project_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_integration_endpoint_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_integration_endpoint_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
    await q.query(
      'CREATE TABLE `integration_publisher_checkpoints` (`publisher` varchar(80) NOT NULL, `occurred_at` datetime(6) NULL, `event_id` varchar(36) NULL, `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`publisher`)) ENGINE=InnoDB',
    );
    await q.query(
      "CREATE TABLE `integration_deliveries` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `project_id` int NULL, `endpoint_id` varchar(36) NOT NULL, `audit_event_id` varchar(36) NOT NULL, `generation` int UNSIGNED NOT NULL DEFAULT 1, `state` varchar(20) NOT NULL DEFAULT 'queued', `attempt_count` int UNSIGNED NOT NULL DEFAULT 0, `next_attempt_at` datetime(6) NULL, `lease_expires_at` datetime(6) NULL, `failure_code` varchar(80) NULL, `replayed_by_user_id` bigint NULL, `replay_reason` varchar(500) NULL, `completed_at` datetime(6) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_integration_delivery_generation` (`endpoint_id`,`audit_event_id`,`generation`), INDEX `IDX_integration_delivery_worker` (`state`,`next_attempt_at`), INDEX `IDX_integration_delivery_org_created` (`organization_id`,`created_at`), INDEX `IDX_integration_delivery_event` (`audit_event_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_integration_delivery_endpoint` FOREIGN KEY (`endpoint_id`) REFERENCES `integration_endpoints`(`id`) ON DELETE CASCADE) ENGINE=InnoDB",
    );
    await q.query(
      'CREATE TABLE `integration_delivery_attempts` (`id` varchar(36) NOT NULL, `delivery_id` varchar(36) NOT NULL, `attempt_number` int UNSIGNED NOT NULL, `outcome` varchar(20) NOT NULL, `status_code` int UNSIGNED NULL, `error_code` varchar(80) NULL, `duration_ms` int UNSIGNED NULL, `next_attempt_at` datetime(6) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_integration_attempt_number` (`delivery_id`,`attempt_number`), PRIMARY KEY (`id`), CONSTRAINT `FK_integration_attempt_delivery` FOREIGN KEY (`delivery_id`) REFERENCES `integration_deliveries`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `integration_delivery_attempts`');
    await q.query('DROP TABLE `integration_deliveries`');
    await q.query('DROP TABLE `integration_publisher_checkpoints`');
    await q.query('DROP TABLE `integration_endpoints`');
  }
}
