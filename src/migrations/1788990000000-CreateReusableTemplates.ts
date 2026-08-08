import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateReusableTemplates1788990000000
  implements MigrationInterface
{
  name = 'CreateReusableTemplates1788990000000';
  async up(q: QueryRunner) {
    await q.query(
      "CREATE TABLE `reusable_templates` (`id` varchar(36) NOT NULL,`organization_id` varchar(36) NOT NULL,`source_project_id` int NULL,`type` enum ('task','checklist','project') NOT NULL,`name` varchar(180) NOT NULL,`description` text NULL,`created_by_id` bigint NOT NULL,`archived_at` datetime NULL,`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),INDEX `IDX_reusable_templates_org_type_archive` (`organization_id`,`type`,`archived_at`),PRIMARY KEY (`id`),CONSTRAINT `FK_reusable_templates_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_reusable_templates_project` FOREIGN KEY (`source_project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL,CONSTRAINT `FK_reusable_templates_creator` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB",
    );
    await q.query(
      'CREATE TABLE `reusable_template_versions` (`id` varchar(36) NOT NULL,`template_id` varchar(36) NOT NULL,`version_number` int UNSIGNED NOT NULL,`snapshot` json NOT NULL,`created_by_id` bigint NOT NULL,`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),UNIQUE INDEX `UQ_reusable_template_version` (`template_id`,`version_number`),PRIMARY KEY (`id`),CONSTRAINT `FK_reusable_template_versions_template` FOREIGN KEY (`template_id`) REFERENCES `reusable_templates`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_reusable_template_versions_creator` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT) ENGINE=InnoDB',
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE `reusable_template_versions`');
    await q.query('DROP TABLE `reusable_templates`');
  }
}
