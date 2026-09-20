import { MigrationInterface, QueryRunner } from 'typeorm';

export class GithubIntegration1789900000000 implements MigrationInterface {
  name = 'GithubIntegration1789900000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE \`github_connections\` (\`id\` varchar(36) NOT NULL, \`organization_id\` varchar(36) NOT NULL, \`project_id\` int NOT NULL, \`repository_full_name\` varchar(200) NOT NULL, \`provider_repository_id\` varchar(40) NULL, \`webhook_key\` varchar(64) NOT NULL, \`secret_ciphertext\` text NOT NULL, \`previous_secret_ciphertext\` text NULL, \`previous_secret_expires_at\` datetime(6) NULL, \`active\` tinyint NOT NULL DEFAULT 1, \`created_by_user_id\` bigint NOT NULL, \`last_delivery_at\` datetime(6) NULL, \`last_delivery_state\` varchar(40) NULL, \`health_state\` varchar(30) NOT NULL DEFAULT 'pending', \`consecutive_failures\` int NOT NULL DEFAULT 0, \`health_alerted_at\` datetime(6) NULL, \`rotation_alerted_at\` datetime(6) NULL, \`rotation_confirmed_at\` datetime(6) NULL, \`repository_renamed_at\` datetime(6) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_github_connection_project_repo\` (\`project_id\`,\`repository_full_name\`), UNIQUE INDEX \`UQ_github_connection_webhook_key\` (\`webhook_key\`), UNIQUE INDEX \`UQ_github_connection_provider_repo\` (\`project_id\`,\`provider_repository_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await q.query(
      'ALTER TABLE `github_connections` ADD `archived_at` datetime(6) NULL',
    );
    await q.query(
      `CREATE TABLE \`github_deliveries\` (\`id\` varchar(36) NOT NULL, \`organization_id\` varchar(36) NOT NULL, \`project_id\` int NOT NULL, \`connection_id\` varchar(36) NOT NULL, \`provider_delivery_id\` varchar(100) NOT NULL, \`event\` varchar(60) NOT NULL, \`action\` varchar(60) NULL, \`state\` varchar(30) NOT NULL, \`failure_code\` varchar(80) NULL, \`artifact_count\` int NOT NULL DEFAULT 0, \`link_count\` int NOT NULL DEFAULT 0, \`received_at\` datetime(6) NOT NULL, \`processed_at\` datetime(6) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_github_delivery_provider\` (\`connection_id\`,\`provider_delivery_id\`), INDEX \`IDX_github_delivery_connection_received\` (\`connection_id\`,\`received_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE \`github_artifacts\` (\`id\` varchar(36) NOT NULL, \`organization_id\` varchar(36) NOT NULL, \`project_id\` int NOT NULL, \`connection_id\` varchar(36) NOT NULL, \`artifact_type\` varchar(30) NOT NULL, \`provider_id\` varchar(160) NOT NULL, \`reference\` varchar(100) NULL, \`title\` varchar(500) NULL, \`state\` varchar(60) NULL, \`url\` varchar(2048) NOT NULL, \`actor_label\` varchar(160) NULL, \`metadata\` json NULL, \`last_delivery_id\` varchar(100) NOT NULL, \`provider_updated_at\` datetime(6) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_github_artifact_identity\` (\`connection_id\`,\`artifact_type\`,\`provider_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE \`github_task_links\` (\`id\` varchar(36) NOT NULL, \`organization_id\` varchar(36) NOT NULL, \`project_id\` int NOT NULL, \`artifact_id\` varchar(36) NOT NULL, \`task_id\` int NOT NULL, \`first_delivery_id\` varchar(100) NOT NULL, \`last_delivery_id\` varchar(100) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_github_task_artifact\` (\`artifact_id\`,\`task_id\`), INDEX \`IDX_github_task_links_task\` (\`task_id\`,\`updated_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await q.query(
      'ALTER TABLE `github_connections` ADD CONSTRAINT `FK_github_connection_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE',
    );
    await q.query(
      'ALTER TABLE `github_deliveries` ADD CONSTRAINT `FK_github_delivery_connection` FOREIGN KEY (`connection_id`) REFERENCES `github_connections`(`id`) ON DELETE CASCADE',
    );
    await q.query(
      'ALTER TABLE `github_artifacts` ADD CONSTRAINT `FK_github_artifact_connection` FOREIGN KEY (`connection_id`) REFERENCES `github_connections`(`id`) ON DELETE CASCADE',
    );
    await q.query(
      'ALTER TABLE `github_task_links` ADD CONSTRAINT `FK_github_link_artifact` FOREIGN KEY (`artifact_id`) REFERENCES `github_artifacts`(`id`) ON DELETE CASCADE',
    );
    await q.query(
      'ALTER TABLE `github_task_links` ADD CONSTRAINT `FK_github_link_task` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `github_task_links`');
    await q.query('DROP TABLE `github_artifacts`');
    await q.query('DROP TABLE `github_deliveries`');
    await q.query('DROP TABLE `github_connections`');
  }
}
