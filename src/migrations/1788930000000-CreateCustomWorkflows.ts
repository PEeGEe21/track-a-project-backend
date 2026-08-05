import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomWorkflows1788930000000 implements MigrationInterface {
  name = 'CreateCustomWorkflows1788930000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE `project_workflows` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `project_id` int NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_project_workflows_project` (`project_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_project_workflows_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_project_workflows_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
    await q.query(
      "CREATE TABLE `project_workflow_versions` (`id` varchar(36) NOT NULL, `workflow_id` varchar(36) NOT NULL, `version_number` int UNSIGNED NOT NULL, `state` enum ('draft','published','retired') NOT NULL, `name` varchar(180) NOT NULL DEFAULT 'Project workflow', `description` text NULL, `created_by_id` bigint NULL, `published_by_id` bigint NULL, `published_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_project_workflow_version_number` (`workflow_id`,`version_number`), INDEX `IDX_project_workflow_version_state` (`workflow_id`,`state`), PRIMARY KEY (`id`), CONSTRAINT `FK_project_workflow_version_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `project_workflows`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_project_workflow_version_creator` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL, CONSTRAINT `FK_project_workflow_version_publisher` FOREIGN KEY (`published_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL) ENGINE=InnoDB",
    );
    await q.query(
      'CREATE TABLE `project_workflow_statuses` (`id` varchar(36) NOT NULL, `version_id` varchar(36) NOT NULL, `status_id` int NOT NULL, `key` varchar(100) NOT NULL, `position` int UNSIGNED NOT NULL DEFAULT 0, `is_initial` tinyint NOT NULL DEFAULT 0, `is_terminal` tinyint NOT NULL DEFAULT 0, UNIQUE INDEX `UQ_project_workflow_status_key` (`version_id`,`key`), UNIQUE INDEX `UQ_project_workflow_status_link` (`version_id`,`status_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_project_workflow_status_version` FOREIGN KEY (`version_id`) REFERENCES `project_workflow_versions`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_project_workflow_status_status` FOREIGN KEY (`status_id`) REFERENCES `status`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB',
    );
    await q.query(
      'CREATE TABLE `project_workflow_transitions` (`id` varchar(36) NOT NULL, `version_id` varchar(36) NOT NULL, `source_status_id` varchar(36) NOT NULL, `destination_status_id` varchar(36) NOT NULL, `key` varchar(180) NOT NULL, `label` varchar(180) NULL, `allowed_roles` json NOT NULL, `requirements` json NULL, UNIQUE INDEX `UQ_project_workflow_transition_key` (`version_id`,`key`), UNIQUE INDEX `UQ_project_workflow_transition_edge` (`version_id`,`source_status_id`,`destination_status_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_project_workflow_transition_version` FOREIGN KEY (`version_id`) REFERENCES `project_workflow_versions`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_project_workflow_transition_source` FOREIGN KEY (`source_status_id`) REFERENCES `project_workflow_statuses`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_project_workflow_transition_destination` FOREIGN KEY (`destination_status_id`) REFERENCES `project_workflow_statuses`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
    await q.query(
      'CREATE TABLE `task_transition_history` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `project_id` int NOT NULL, `task_id` int NOT NULL, `workflow_version_id` varchar(36) NOT NULL, `transition_key` varchar(180) NOT NULL, `source_status_id` int NOT NULL, `source_status_title` varchar(180) NOT NULL, `destination_status_id` int NOT NULL, `destination_status_title` varchar(180) NOT NULL, `actor_id` bigint NULL, `validated_fields` json NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `IDX_task_transition_history_task` (`task_id`,`created_at`), INDEX `IDX_task_transition_history_project` (`project_id`,`created_at`), PRIMARY KEY (`id`), CONSTRAINT `FK_task_transition_history_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_task_transition_history_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_task_transition_history_task` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_task_transition_history_version` FOREIGN KEY (`workflow_version_id`) REFERENCES `project_workflow_versions`(`id`) ON DELETE RESTRICT, CONSTRAINT `FK_task_transition_history_actor` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL) ENGINE=InnoDB',
    );

    await q.query(
      'INSERT INTO `project_workflows` (`id`,`organization_id`,`project_id`) SELECT UUID(), p.`organization_id`, p.`id` FROM `projects` p WHERE p.`organization_id` IS NOT NULL',
    );
    await q.query(
      "INSERT INTO `project_workflow_versions` (`id`,`workflow_id`,`version_number`,`state`,`name`,`published_at`) SELECT UUID(), w.`id`, 1, 'published', 'Compatible default workflow', CURRENT_TIMESTAMP FROM `project_workflows` w",
    );
    await q.query(
      "INSERT INTO `project_workflow_statuses` (`id`,`version_id`,`status_id`,`key`,`position`,`is_initial`,`is_terminal`) SELECT UUID(), v.`id`, s.`id`, CONCAT('status_',s.`id`), s.`tab_id`, CASE WHEN s.`id` = first_status.`id` THEN 1 ELSE 0 END, s.`isTerminal` FROM `project_workflow_versions` v INNER JOIN `project_workflows` w ON w.`id`=v.`workflow_id` INNER JOIN `status` s ON s.`projectId`=w.`project_id` LEFT JOIN `status` first_status ON first_status.`id`=(SELECT s2.`id` FROM `status` s2 WHERE s2.`projectId`=w.`project_id` ORDER BY s2.`tab_id`,s2.`id` LIMIT 1) WHERE v.`version_number`=1",
    );
    await q.query(
      "INSERT INTO `project_workflow_transitions` (`id`,`version_id`,`source_status_id`,`destination_status_id`,`key`,`label`,`allowed_roles`,`requirements`) SELECT UUID(), src.`version_id`, src.`id`, dst.`id`, CONCAT(src.`key`,'_to_',dst.`key`), CONCAT(ss.`title`,' → ',ds.`title`), JSON_ARRAY('contributor','editor','owner'), JSON_OBJECT('standardFields',JSON_ARRAY(),'customFieldIds',JSON_ARRAY()) FROM `project_workflow_statuses` src INNER JOIN `project_workflow_statuses` dst ON dst.`version_id`=src.`version_id` AND dst.`id`<>src.`id` INNER JOIN `status` ss ON ss.`id`=src.`status_id` INNER JOIN `status` ds ON ds.`id`=dst.`status_id`",
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `task_transition_history`');
    await q.query('DROP TABLE `project_workflow_transitions`');
    await q.query('DROP TABLE `project_workflow_statuses`');
    await q.query('DROP TABLE `project_workflow_versions`');
    await q.query('DROP TABLE `project_workflows`');
  }
}
