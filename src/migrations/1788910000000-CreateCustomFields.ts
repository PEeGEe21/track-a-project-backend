import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomFields1788910000000 implements MigrationInterface {
  name = 'CreateCustomFields1788910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `custom_field_definitions` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `project_id` int NOT NULL, `key` varchar(80) NOT NULL, `name` varchar(120) NOT NULL, `description` text NULL, `type` enum ('text','number','date','single_select','multi_select','checkbox','person','url') NOT NULL, `required` tinyint NOT NULL DEFAULT 0, `position` int UNSIGNED NOT NULL DEFAULT 0, `default_value` json NULL, `archived_at` datetime NULL, `created_by_id` bigint NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_custom_field_definition_project_key` (`project_id`, `key`), INDEX `IDX_custom_field_definition_list` (`organization_id`, `project_id`, `archived_at`, `position`), PRIMARY KEY (`id`), CONSTRAINT `FK_custom_field_definition_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_custom_field_definition_creator` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'CREATE TABLE `custom_field_options` (`id` varchar(36) NOT NULL, `definition_id` varchar(36) NOT NULL, `key` varchar(80) NOT NULL, `label` varchar(120) NOT NULL, `color` varchar(32) NULL, `position` int UNSIGNED NOT NULL DEFAULT 0, `archived_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_custom_field_option_definition_key` (`definition_id`, `key`), INDEX `IDX_custom_field_option_list` (`definition_id`, `archived_at`, `position`), PRIMARY KEY (`id`), CONSTRAINT `FK_custom_field_option_definition` FOREIGN KEY (`definition_id`) REFERENCES `custom_field_definitions`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `task_custom_field_values` (`id` varchar(36) NOT NULL, `task_id` int NOT NULL, `definition_id` varchar(36) NOT NULL, `value` json NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_task_custom_field_value` (`task_id`, `definition_id`), INDEX `IDX_task_custom_field_definition` (`definition_id`, `task_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_task_custom_field_value_task` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_task_custom_field_value_definition` FOREIGN KEY (`definition_id`) REFERENCES `custom_field_definitions`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `task_custom_field_values`');
    await queryRunner.query('DROP TABLE `custom_field_options`');
    await queryRunner.query('DROP TABLE `custom_field_definitions`');
  }
}
