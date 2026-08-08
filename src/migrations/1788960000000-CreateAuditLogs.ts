import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1788960000000 implements MigrationInterface {
  name = 'CreateAuditLogs1788960000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('audit_logs')) return;

    await queryRunner.query(
      'CREATE TABLE `audit_logs` (`id` varchar(36) NOT NULL, `action` varchar(255) NOT NULL, `admin_id` bigint NULL, `target_user_id` bigint NULL, `organization_id` varchar(36) NULL, `metadata` json NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `IDX_audit_logs_action_created` (`action`,`created_at`), INDEX `IDX_audit_logs_admin_created` (`admin_id`,`created_at`), INDEX `IDX_audit_logs_organization_created` (`organization_id`,`created_at`), PRIMARY KEY (`id`), CONSTRAINT `FK_audit_logs_admin` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL, CONSTRAINT `FK_audit_logs_target_user` FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL, CONSTRAINT `FK_audit_logs_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL) ENGINE=InnoDB',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('audit_logs')) {
      await queryRunner.query('DROP TABLE `audit_logs`');
    }
  }
}
