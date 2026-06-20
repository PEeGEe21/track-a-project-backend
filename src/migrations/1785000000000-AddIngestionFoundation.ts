import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIngestionFoundation1785000000000
  implements MigrationInterface
{
  name = 'AddIngestionFoundation1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `status` ADD `isTerminal` tinyint NOT NULL DEFAULT 0',
    );

    await queryRunner.query(
      'ALTER TABLE `projects` ADD `default_ingestion_status_id` int NULL',
    );

    await queryRunner.query(
      'ALTER TABLE `projects` ADD CONSTRAINT `FK_projects_default_ingestion_status` FOREIGN KEY (`default_ingestion_status_id`) REFERENCES `status`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );

    await queryRunner.query(`
      CREATE TABLE \`ingest_api_keys\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`project_id\` int NOT NULL,
        \`organization_id\` varchar(36) NOT NULL,
        \`key_hash\` varchar(255) NOT NULL,
        \`key_prefix\` varchar(32) NOT NULL,
        \`label\` varchar(255) NOT NULL,
        \`revoked_at\` datetime NULL,
        \`last_used_at\` datetime NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_ingest_api_keys_key_hash\` (\`key_hash\`),
        INDEX \`IDX_ingest_api_keys_project_revoked\` (\`project_id\`, \`revoked_at\`),
        INDEX \`IDX_ingest_api_keys_org_revoked\` (\`organization_id\`, \`revoked_at\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(
      'ALTER TABLE `ingest_api_keys` ADD CONSTRAINT `FK_ingest_api_keys_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );

    await queryRunner.query(
      'ALTER TABLE `ingest_api_keys` ADD CONSTRAINT `FK_ingest_api_keys_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );

    await queryRunner.query(`
      CREATE TABLE \`ingested_events\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`task_id\` int NOT NULL,
        \`project_id\` int NOT NULL,
        \`organization_id\` varchar(36) NOT NULL,
        \`source\` varchar(100) NOT NULL,
        \`severity\` varchar(32) NOT NULL,
        \`dedupe_key\` varchar(255) NOT NULL,
        \`metadata\` json NULL,
        \`occurrence_count\` int NOT NULL DEFAULT 1,
        \`last_seen_at\` datetime NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_ingested_events_project_dedupe\` (\`project_id\`, \`dedupe_key\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(
      'ALTER TABLE `ingested_events` ADD CONSTRAINT `FK_ingested_events_task` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );

    await queryRunner.query(
      'ALTER TABLE `ingested_events` ADD CONSTRAINT `FK_ingested_events_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );

    await queryRunner.query(
      'ALTER TABLE `ingested_events` ADD CONSTRAINT `FK_ingested_events_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `ingested_events` DROP FOREIGN KEY `FK_ingested_events_organization`',
    );
    await queryRunner.query(
      'ALTER TABLE `ingested_events` DROP FOREIGN KEY `FK_ingested_events_project`',
    );
    await queryRunner.query(
      'ALTER TABLE `ingested_events` DROP FOREIGN KEY `FK_ingested_events_task`',
    );
    await queryRunner.query('DROP TABLE `ingested_events`');

    await queryRunner.query(
      'ALTER TABLE `ingest_api_keys` DROP FOREIGN KEY `FK_ingest_api_keys_organization`',
    );
    await queryRunner.query(
      'ALTER TABLE `ingest_api_keys` DROP FOREIGN KEY `FK_ingest_api_keys_project`',
    );
    await queryRunner.query('DROP TABLE `ingest_api_keys`');

    await queryRunner.query(
      'ALTER TABLE `projects` DROP FOREIGN KEY `FK_projects_default_ingestion_status`',
    );
    await queryRunner.query(
      'ALTER TABLE `projects` DROP COLUMN `default_ingestion_status_id`',
    );

    await queryRunner.query('ALTER TABLE `status` DROP COLUMN `isTerminal`');
  }
}
