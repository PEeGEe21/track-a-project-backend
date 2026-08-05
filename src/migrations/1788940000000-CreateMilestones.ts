import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMilestones1788940000000 implements MigrationInterface {
  name = 'CreateMilestones1788940000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `milestones` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `project_id` int NOT NULL, `title` varchar(180) NOT NULL, `description` text NULL, `completion_criteria` text NULL, `target_date` date NULL, `status` enum ('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned', `health` enum ('on_track','at_risk','off_track') NOT NULL DEFAULT 'on_track', `owner_id` bigint NULL, `created_by_id` bigint NOT NULL, `achieved_at` datetime NULL, `completion_reason` text NULL, `archived_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `IDX_milestones_project_status_target` (`project_id`,`status`,`target_date`), INDEX `IDX_milestones_organization` (`organization_id`), INDEX `IDX_milestones_owner` (`owner_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_milestones_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_milestones_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_milestones_owner` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL, CONSTRAINT `FK_milestones_created_by` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'CREATE TABLE `milestone_tasks` (`id` int NOT NULL AUTO_INCREMENT, `milestone_id` varchar(36) NOT NULL, `task_id` int NOT NULL, `counts_toward_progress` tinyint NOT NULL DEFAULT 1, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_milestone_task` (`milestone_id`,`task_id`), INDEX `IDX_milestone_tasks_task` (`task_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_milestone_tasks_milestone` FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_milestone_tasks_task` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `milestone_tasks`');
    await queryRunner.query('DROP TABLE `milestones`');
  }
}
