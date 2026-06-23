import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairOrganizationSettingsTable1788600000000
  implements MigrationInterface
{
  name = 'RepairOrganizationSettingsTable1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasSettingsTable = await queryRunner.hasTable('organization_settings');
    if (!hasSettingsTable) {
      await queryRunner.query(`
        CREATE TABLE \`organization_settings\` (
          \`id\` varchar(36) NOT NULL,
          \`organization_id\` varchar(36) NOT NULL,
          \`deadline_reminders_enabled\` tinyint NOT NULL DEFAULT 0,
          \`deadline_reminder_days_before\` int NOT NULL DEFAULT 3,
          \`deadline_reminder_hour\` int NOT NULL DEFAULT 9,
          \`deadline_reminder_minute\` int NOT NULL DEFAULT 0,
          \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          UNIQUE INDEX \`IDX_organization_settings_organization_id\` (\`organization_id\`),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
    }

    const settingsTable = await queryRunner.getTable('organization_settings');

    if (
      settingsTable &&
      !settingsTable.findColumnByName('deadline_reminder_hour')
    ) {
      await queryRunner.query(
        'ALTER TABLE `organization_settings` ADD COLUMN `deadline_reminder_hour` int NOT NULL DEFAULT 9',
      );
    }

    if (
      settingsTable &&
      !settingsTable.findColumnByName('deadline_reminder_minute')
    ) {
      await queryRunner.query(
        'ALTER TABLE `organization_settings` ADD COLUMN `deadline_reminder_minute` int NOT NULL DEFAULT 0',
      );
    }

    const refreshedSettingsTable = await queryRunner.getTable(
      'organization_settings',
    );
    const hasOrganizationSettingsFk = refreshedSettingsTable?.foreignKeys.some(
      (foreignKey) => foreignKey.name === 'FK_organization_settings_organization',
    );

    if (!hasOrganizationSettingsFk) {
      await queryRunner.query(`
        ALTER TABLE \`organization_settings\`
        ADD CONSTRAINT \`FK_organization_settings_organization\`
        FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\`(\`id\`)
        ON DELETE CASCADE ON UPDATE NO ACTION
      `);
    }

    const hasRemindersEnabledColumn = await queryRunner.hasColumn(
      'organizations',
      'deadline_reminders_enabled',
    );
    const hasReminderDaysColumn = await queryRunner.hasColumn(
      'organizations',
      'deadline_reminder_days_before',
    );
    const hasReminderHourColumn = await queryRunner.hasColumn(
      'organizations',
      'deadline_reminder_hour',
    );
    const hasReminderMinuteColumn = await queryRunner.hasColumn(
      'organizations',
      'deadline_reminder_minute',
    );

    await queryRunner.query(`
      INSERT INTO \`organization_settings\` (
        \`id\`,
        \`organization_id\`,
        \`deadline_reminders_enabled\`,
        \`deadline_reminder_days_before\`,
        \`deadline_reminder_hour\`,
        \`deadline_reminder_minute\`
      )
      SELECT
        UUID(),
        \`id\`,
        ${
          hasRemindersEnabledColumn ? '`deadline_reminders_enabled`' : '0'
        },
        ${
          hasReminderDaysColumn ? '`deadline_reminder_days_before`' : '3'
        },
        ${hasReminderHourColumn ? '`deadline_reminder_hour`' : '9'},
        ${hasReminderMinuteColumn ? '`deadline_reminder_minute`' : '0'}
      FROM \`organizations\`
      WHERE \`id\` NOT IN (
        SELECT \`organization_id\` FROM \`organization_settings\`
      )
    `);

    if (hasReminderMinuteColumn) {
      await queryRunner.query(
        'ALTER TABLE `organizations` DROP COLUMN `deadline_reminder_minute`',
      );
    }

    if (hasReminderHourColumn) {
      await queryRunner.query(
        'ALTER TABLE `organizations` DROP COLUMN `deadline_reminder_hour`',
      );
    }

    if (hasReminderDaysColumn) {
      await queryRunner.query(
        'ALTER TABLE `organizations` DROP COLUMN `deadline_reminder_days_before`',
      );
    }

    if (hasRemindersEnabledColumn) {
      await queryRunner.query(
        'ALTER TABLE `organizations` DROP COLUMN `deadline_reminders_enabled`',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasSettingsTable = await queryRunner.hasTable('organization_settings');
    if (!hasSettingsTable) {
      return;
    }

    const hasRemindersEnabledColumn = await queryRunner.hasColumn(
      'organizations',
      'deadline_reminders_enabled',
    );
    if (!hasRemindersEnabledColumn) {
      await queryRunner.query(
        'ALTER TABLE `organizations` ADD COLUMN `deadline_reminders_enabled` tinyint NOT NULL DEFAULT 0',
      );
    }

    const hasReminderDaysColumn = await queryRunner.hasColumn(
      'organizations',
      'deadline_reminder_days_before',
    );
    if (!hasReminderDaysColumn) {
      await queryRunner.query(
        'ALTER TABLE `organizations` ADD COLUMN `deadline_reminder_days_before` int NOT NULL DEFAULT 3',
      );
    }

    const hasReminderHourColumn = await queryRunner.hasColumn(
      'organizations',
      'deadline_reminder_hour',
    );
    if (!hasReminderHourColumn) {
      await queryRunner.query(
        'ALTER TABLE `organizations` ADD COLUMN `deadline_reminder_hour` int NOT NULL DEFAULT 9',
      );
    }

    const hasReminderMinuteColumn = await queryRunner.hasColumn(
      'organizations',
      'deadline_reminder_minute',
    );
    if (!hasReminderMinuteColumn) {
      await queryRunner.query(
        'ALTER TABLE `organizations` ADD COLUMN `deadline_reminder_minute` int NOT NULL DEFAULT 0',
      );
    }

    await queryRunner.query(`
      UPDATE \`organizations\` org
      INNER JOIN \`organization_settings\` settings
        ON settings.\`organization_id\` = org.\`id\`
      SET
        org.\`deadline_reminders_enabled\` = settings.\`deadline_reminders_enabled\`,
        org.\`deadline_reminder_days_before\` = settings.\`deadline_reminder_days_before\`,
        org.\`deadline_reminder_hour\` = settings.\`deadline_reminder_hour\`,
        org.\`deadline_reminder_minute\` = settings.\`deadline_reminder_minute\`
    `);

    const settingsTable = await queryRunner.getTable('organization_settings');
    const settingsFk = settingsTable?.foreignKeys.find(
      (foreignKey) => foreignKey.name === 'FK_organization_settings_organization',
    );
    if (settingsFk) {
      await queryRunner.query(
        'ALTER TABLE `organization_settings` DROP FOREIGN KEY `FK_organization_settings_organization`',
      );
    }

    await queryRunner.query('DROP TABLE `organization_settings`');
  }
}
