import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskWatchers1789080000000 implements MigrationInterface {
  name = 'CreateTaskWatchers1789080000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TABLE `task_watchers` (`id` varchar(36) NOT NULL,`task_id` int NOT NULL,`user_id` bigint NOT NULL,`organization_id` varchar(36) NOT NULL,`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),UNIQUE INDEX `UQ_task_watcher` (`task_id`,`user_id`),INDEX `IDX_task_watchers_org_user` (`organization_id`,`user_id`),PRIMARY KEY (`id`),CONSTRAINT `FK_task_watcher_task` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_task_watcher_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,CONSTRAINT `FK_task_watcher_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `task_watchers`');
  }
}
