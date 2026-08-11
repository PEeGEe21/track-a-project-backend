import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIntakeAiSuggestions1789050000000
  implements MigrationInterface
{
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      "CREATE TABLE `intake_ai_suggestions` (`id` varchar(36) NOT NULL,`organization_id` varchar(36) NOT NULL,`project_id` int NOT NULL,`event_id` varchar(36) NOT NULL,`state` enum ('pending','applied','dismissed','stale') NOT NULL DEFAULT 'pending',`payload_fingerprint` varchar(64) NOT NULL,`proposed_changes` json NOT NULL,`reasons` json NOT NULL,`confidence` json NOT NULL,`correlation_id` varchar(36) NOT NULL,`template_id` varchar(80) NOT NULL,`template_version` int UNSIGNED NOT NULL,`created_by_id` bigint NOT NULL,`reviewed_by_id` bigint NULL,`reviewed_at` datetime NULL,`review_note` varchar(500) NULL,`contract_version` int UNSIGNED NOT NULL DEFAULT 1,`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),INDEX `IDX_intake_ai_suggestions_event_state` (`event_id`,`state`),INDEX `IDX_intake_ai_suggestions_project_created` (`project_id`,`created_at`),PRIMARY KEY (`id`),CONSTRAINT `FK_intake_ai_suggestion_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_intake_ai_suggestion_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_intake_ai_suggestion_event` FOREIGN KEY (`event_id`) REFERENCES `intake_events`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_intake_ai_suggestion_creator` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,CONSTRAINT `FK_intake_ai_suggestion_reviewer` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL) ENGINE=InnoDB",
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `intake_ai_suggestions`');
  }
}
