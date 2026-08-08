import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateBasicApprovals1788980000000 implements MigrationInterface {
  name = 'CreateBasicApprovals1788980000000';
  async up(q: QueryRunner) {
    await q.query(
      "CREATE TABLE `approval_requests` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `project_id` int NOT NULL, `subject_type` enum ('task','document','milestone') NOT NULL, `subject_id` varchar(64) NOT NULL, `subject_snapshot` json NOT NULL, `subject_revision` varchar(64) NOT NULL, `status` enum ('pending','approved','rejected','invalidated','cancelled') NOT NULL DEFAULT 'pending', `requested_by_id` bigint NOT NULL, `message` text NULL, `due_at` datetime NULL, `rejection_comment_required` tinyint NOT NULL DEFAULT 0, `resolved_at` datetime NULL, `reminder_sent_at` datetime NULL, `invalidation_reason` text NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `IDX_approval_requests_project_status` (`project_id`,`status`,`created_at`), INDEX `IDX_approval_requests_subject` (`subject_type`,`subject_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_approval_requests_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_approval_requests_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_approval_requests_requester` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB",
    );
    await q.query(
      'CREATE TABLE `approval_reviewers` (`id` varchar(36) NOT NULL, `request_id` varchar(36) NOT NULL, `reviewer_id` bigint NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_approval_reviewer` (`request_id`,`reviewer_id`), INDEX `IDX_approval_reviewer_inbox` (`reviewer_id`,`created_at`), PRIMARY KEY (`id`), CONSTRAINT `FK_approval_reviewers_request` FOREIGN KEY (`request_id`) REFERENCES `approval_requests`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_approval_reviewers_user` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
    await q.query(
      "CREATE TABLE `approval_responses` (`id` varchar(36) NOT NULL, `request_id` varchar(36) NOT NULL, `reviewer_id` bigint NOT NULL, `decision` enum ('approved','rejected') NOT NULL, `comment` text NULL, `subject_snapshot` json NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_approval_response_reviewer` (`request_id`,`reviewer_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_approval_responses_request` FOREIGN KEY (`request_id`) REFERENCES `approval_requests`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_approval_responses_user` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB",
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE `approval_responses`');
    await q.query('DROP TABLE `approval_reviewers`');
    await q.query('DROP TABLE `approval_requests`');
  }
}
