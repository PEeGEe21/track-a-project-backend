import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateWorkflows1788810000000 implements MigrationInterface {
  name = 'CreateWorkflows1788810000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `notes` ADD `project_id` int NULL');
    await q.query(
      'ALTER TABLE `notes` ADD CONSTRAINT `FK_notes_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE',
    );
    await q.query(
      'CREATE TABLE `workflow_templates` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `source_project_id` int NOT NULL, `created_by_id` int NOT NULL, `name` varchar(180) NOT NULL, `description` text NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    await q.query(
      'CREATE TABLE `workflow_steps` (`id` varchar(36) NOT NULL, `template_id` varchar(36) NOT NULL, `position` int NOT NULL, `source_task_id` int NOT NULL, `title` varchar(255) NOT NULL, `description` longtext NULL, `source_status_title` varchar(180) NULL, `source_assignee_id` int NULL, `due_offset_days` int NULL, INDEX `IDX_workflow_steps_order` (`template_id`, `position`), PRIMARY KEY (`id`), CONSTRAINT `FK_workflow_steps_template` FOREIGN KEY (`template_id`) REFERENCES `workflow_templates`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
    await q.query(
      "CREATE TABLE `work_conversions` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `source_project_id` int NOT NULL, `destination_project_id` int NULL, `source_type` enum ('whiteboard_object','task_selection','workflow_step') NOT NULL, `source_key` varchar(255) NOT NULL, `target_type` enum ('task','note','workflow_template') NOT NULL, `target_id` varchar(64) NOT NULL, `batch_id` varchar(36) NOT NULL, `created_by_id` int NOT NULL, `metadata` json NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `IDX_work_conversion_source` (`organization_id`, `source_type`, `source_key`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `work_conversions`');
    await q.query('DROP TABLE `workflow_steps`');
    await q.query('DROP TABLE `workflow_templates`');
    await q.query('ALTER TABLE `notes` DROP FOREIGN KEY `FK_notes_project`');
    await q.query('ALTER TABLE `notes` DROP COLUMN `project_id`');
  }
}
