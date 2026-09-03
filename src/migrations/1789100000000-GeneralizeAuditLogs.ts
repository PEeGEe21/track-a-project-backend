import { MigrationInterface, QueryRunner } from 'typeorm';

export class GeneralizeAuditLogs1789100000000 implements MigrationInterface {
  name = 'GeneralizeAuditLogs1789100000000';

  async up(q: QueryRunner): Promise<void> {
    const columns: ReadonlyArray<readonly [string, string]> = [
      ['schema_version', '`schema_version` int UNSIGNED NULL'],
      ['project_id', '`project_id` int NULL'],
      ['actor_type', '`actor_type` varchar(20) NULL'],
      ['actor_id', '`actor_id` varchar(80) NULL'],
      ['actor_label', '`actor_label` varchar(160) NULL'],
      ['responsible_user_id', '`responsible_user_id` bigint NULL'],
      ['subject_type', '`subject_type` varchar(80) NULL'],
      ['subject_id', '`subject_id` varchar(80) NULL'],
      ['subject_label', '`subject_label` varchar(200) NULL'],
      ['source', '`source` varchar(30) NULL'],
      ['outcome', '`outcome` varchar(20) NULL'],
      ['before_changes', '`before_changes` json NULL'],
      ['after_changes', '`after_changes` json NULL'],
      ['request_id', '`request_id` varchar(80) NULL'],
      ['correlation_id', '`correlation_id` varchar(80) NULL'],
      ['causation_id', '`causation_id` varchar(80) NULL'],
      ['source_event_key', '`source_event_key` varchar(80) NULL'],
      ['occurred_at', '`occurred_at` datetime(6) NULL'],
      ['retention_expires_at', '`retention_expires_at` datetime(6) NULL'],
    ];
    const missingColumns: string[] = [];
    for (const [name, definition] of columns) {
      if (!(await q.hasColumn('audit_logs', name))) {
        missingColumns.push(`ADD COLUMN ${definition}`);
      }
    }
    if (missingColumns.length > 0) {
      await q.query(`ALTER TABLE \`audit_logs\` ${missingColumns.join(', ')}`);
    }
    await q.query(
      "UPDATE `audit_logs` SET `schema_version` = 1, `actor_type` = CASE WHEN `admin_id` IS NULL THEN 'system' ELSE 'admin' END, `actor_id` = CASE WHEN `admin_id` IS NULL THEN NULL ELSE CAST(`admin_id` AS CHAR) END, `actor_label` = CASE WHEN `admin_id` IS NULL THEN 'Legacy system' ELSE 'Legacy administrator' END, `subject_type` = CASE WHEN `target_user_id` IS NULL THEN NULL ELSE 'user' END, `subject_id` = CASE WHEN `target_user_id` IS NULL THEN NULL ELSE CAST(`target_user_id` AS CHAR) END, `source` = 'migration', `outcome` = 'succeeded', `correlation_id` = `id`, `occurred_at` = `created_at` WHERE `schema_version` IS NULL",
    );
    await q.query(
      'ALTER TABLE `audit_logs` MODIFY `schema_version` int UNSIGNED NOT NULL DEFAULT 1',
    );
    await q.query(
      'ALTER TABLE `audit_logs` ADD INDEX `IDX_audit_org_occurred_id` (`organization_id`,`occurred_at`,`id`), ADD INDEX `IDX_audit_project_occurred_id` (`project_id`,`occurred_at`,`id`), ADD INDEX `IDX_audit_action_occurred_id` (`action`,`occurred_at`,`id`), ADD INDEX `IDX_audit_subject_occurred_id` (`subject_type`,`subject_id`,`occurred_at`,`id`), ADD INDEX `IDX_audit_actor_occurred_id` (`actor_type`,`actor_id`,`occurred_at`,`id`), ADD INDEX `IDX_audit_org_correlation` (`organization_id`,`correlation_id`), ADD INDEX `IDX_audit_retention_expiry` (`retention_expires_at`,`id`), ADD UNIQUE INDEX `UQ_audit_source_event` (`organization_id`,`source`,`source_event_key`), ADD CONSTRAINT `FK_audit_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL',
    );
    const temporaryOrganizationIndex = await q.query(
      "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND INDEX_NAME = 'IDX_audit_organization_fk' LIMIT 1",
    );
    if (Array.isArray(temporaryOrganizationIndex) && temporaryOrganizationIndex.length > 0) {
      await q.query(
        'ALTER TABLE `audit_logs` DROP INDEX `IDX_audit_organization_fk`',
      );
    }
    await q.query(
      "CREATE TRIGGER `TRG_audit_logs_block_update` BEFORE UPDATE ON `audit_logs` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs rows are append-only'",
    );
    await q.query(
      "CREATE TRIGGER `TRG_audit_logs_block_delete` BEFORE DELETE ON `audit_logs` FOR EACH ROW BEGIN IF COALESCE(@tailpoint_audit_retention_worker, 0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs rows are append-only'; END IF; END",
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TRIGGER IF EXISTS `TRG_audit_logs_block_delete`');
    await q.query('DROP TRIGGER IF EXISTS `TRG_audit_logs_block_update`');
    await q.query('ALTER TABLE `audit_logs` DROP FOREIGN KEY `FK_audit_project`');
    // The pre-existing organization foreign key needs a supporting index after
    // the generalized organization/time index is removed.
    await q.query(
      'ALTER TABLE `audit_logs` ADD INDEX `IDX_audit_organization_fk` (`organization_id`)',
    );
    await q.query(
      'ALTER TABLE `audit_logs` DROP INDEX `UQ_audit_source_event`, DROP INDEX `IDX_audit_retention_expiry`, DROP INDEX `IDX_audit_org_correlation`, DROP INDEX `IDX_audit_actor_occurred_id`, DROP INDEX `IDX_audit_subject_occurred_id`, DROP INDEX `IDX_audit_action_occurred_id`, DROP INDEX `IDX_audit_project_occurred_id`, DROP INDEX `IDX_audit_org_occurred_id`',
    );
    // Columns intentionally remain. Dropping them would silently destroy version-2
    // events during a supported down/up rehearsal.
  }
}
