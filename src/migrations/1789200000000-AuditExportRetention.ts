import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditExportRetention1789200000000 implements MigrationInterface {
  name = 'AuditExportRetention1789200000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query("CREATE TABLE `audit_exports` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `requested_by_user_id` bigint NOT NULL, `format` varchar(10) NOT NULL, `state` varchar(20) NOT NULL DEFAULT 'queued', `filters` json NOT NULL, `watermark_at` datetime(6) NOT NULL, `artifact` longtext NULL, `row_count` int UNSIGNED NOT NULL DEFAULT 0, `failure_code` varchar(80) NULL, `completed_at` datetime(6) NULL, `expires_at` datetime(6) NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `IDX_audit_export_worker` (`state`,`created_at`), INDEX `IDX_audit_export_expiry` (`expires_at`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
    await q.query("CREATE TABLE `audit_retention_policies` (`organization_id` varchar(36) NOT NULL, `retention_days` int UNSIGNED NOT NULL, `updated_by_user_id` bigint NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`organization_id`)) ENGINE=InnoDB");
    await q.query("CREATE TABLE `audit_purge_runs` (`id` varchar(36) NOT NULL, `organization_id` varchar(36) NOT NULL, `requested_by_user_id` bigint NOT NULL, `state` varchar(20) NOT NULL DEFAULT 'queued', `cutoff_at` datetime(6) NOT NULL, `cursor_id` varchar(36) NULL, `deleted_count` int UNSIGNED NOT NULL DEFAULT 0, `failure_code` varchar(80) NULL, `completed_at` datetime(6) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX `IDX_audit_purge_worker` (`state`,`created_at`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `audit_purge_runs`');
    await q.query('DROP TABLE `audit_retention_policies`');
    await q.query('DROP TABLE `audit_exports`');
  }
}
