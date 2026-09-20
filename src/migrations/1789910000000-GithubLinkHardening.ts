import { MigrationInterface, QueryRunner } from 'typeorm';

export class GithubLinkHardening1789910000000 implements MigrationInterface {
  name = 'GithubLinkHardening1789910000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      "ALTER TABLE `github_task_links` ADD `state` varchar(20) NOT NULL DEFAULT 'active', ADD `source` varchar(40) NOT NULL DEFAULT 'legacy', ADD `source_artifact_id` varchar(36) NULL, ADD `source_value` varchar(255) NULL, ADD `created_by_user_id` bigint NULL, ADD `manually_overridden` tinyint NOT NULL DEFAULT 0",
    );
    await q.query(
      'CREATE TABLE `github_link_diagnostics` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `project_id` int NOT NULL, `connection_id` varchar(36) NOT NULL, `delivery_id` varchar(100) NOT NULL, `artifact_provider_id` varchar(160) NOT NULL, `artifact_type` varchar(40) NOT NULL, `source` varchar(40) NOT NULL, `reason` varchar(40) NOT NULL, `token` varchar(40) NOT NULL, `referenced_task_id` int NULL, `resolved_at` datetime(6) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_github_link_diagnostic_delivery_token` (`connection_id`,`delivery_id`,`artifact_provider_id`,`token`), INDEX `IDX_github_link_diagnostic_project` (`project_id`,`resolved_at`,`created_at`), PRIMARY KEY (`id`), CONSTRAINT `FK_github_diagnostic_connection` FOREIGN KEY (`connection_id`) REFERENCES `github_connections`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `github_link_diagnostics`');
    await q.query(
      'ALTER TABLE `github_task_links` DROP COLUMN `manually_overridden`, DROP COLUMN `created_by_user_id`, DROP COLUMN `source_value`, DROP COLUMN `source_artifact_id`, DROP COLUMN `source`, DROP COLUMN `state`',
    );
  }
}
