import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskDependencies1789400000000 implements MigrationInterface {
  name = 'TaskDependencies1789400000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE `task_dependencies` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `task_id` int NOT NULL, `depends_on_task_id` int NOT NULL, `task_title_snapshot` varchar(255) NOT NULL, `depends_on_title_snapshot` varchar(255) NOT NULL, `created_by_user_id` int NOT NULL, `removed_by_user_id` int NULL, `removal_reason` varchar(40) NULL, `active` tinyint NOT NULL DEFAULT 1, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_task_dependency_edge` (`organization_id`,`task_id`,`depends_on_task_id`), INDEX `IDX_task_dependency_lookup` (`organization_id`,`task_id`,`active`), PRIMARY KEY (`id`), CONSTRAINT `FK_task_dependency_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `task_dependencies`');
  }
}
