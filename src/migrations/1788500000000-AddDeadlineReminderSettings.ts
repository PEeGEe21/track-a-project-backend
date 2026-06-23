import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeadlineReminderSettings1788500000000
  implements MigrationInterface
{
  name = 'AddDeadlineReminderSettings1788500000000';

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
    const hasOrganizationSettingsFk = settingsTable?.foreignKeys.some(
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

    const insertMissingSettingsSql = `
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
          hasRemindersEnabledColumn
            ? '`deadline_reminders_enabled`'
            : '0'
        },
        ${
          hasReminderDaysColumn
            ? '`deadline_reminder_days_before`'
            : '3'
        },
        ${
          hasReminderHourColumn
            ? '`deadline_reminder_hour`'
            : '9'
        },
        ${
          hasReminderMinuteColumn
            ? '`deadline_reminder_minute`'
            : '0'
        }
      FROM \`organizations\`
      WHERE \`id\` NOT IN (SELECT \`organization_id\` FROM \`organization_settings\`)
    `;
    await queryRunner.query(insertMissingSettingsSql);

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

    const hasReminderTable = await queryRunner.hasTable(
      'task_deadline_reminders',
    );
    if (!hasReminderTable) {
      await queryRunner.query(`
        CREATE TABLE \`task_deadline_reminders\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`reminder_key\` varchar(255) NOT NULL,
          \`task_id\` int NOT NULL,
          \`recipient_user_id\` bigint NOT NULL,
          \`organization_id\` varchar(36) NULL,
          \`days_before\` int NOT NULL,
          \`due_date\` datetime NOT NULL,
          \`delivery_status\` varchar(32) NOT NULL DEFAULT 'queued',
          \`metadata\` json NULL,
          \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          UNIQUE INDEX \`IDX_task_deadline_reminders_reminder_key\` (\`reminder_key\`),
          INDEX \`IDX_task_deadline_reminders_org_id\` (\`organization_id\`),
          INDEX \`IDX_task_deadline_reminders_task_id\` (\`task_id\`),
          INDEX \`IDX_task_deadline_reminders_recipient_user_id\` (\`recipient_user_id\`),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
    }

    await queryRunner.query(
      'ALTER TABLE `task_deadline_reminders` MODIFY `recipient_user_id` bigint NOT NULL',
    );

    const reminderTable = await queryRunner.getTable('task_deadline_reminders');
    const hasTaskFk = reminderTable?.foreignKeys.some(
      (foreignKey) => foreignKey.name === 'FK_task_deadline_reminders_task',
    );
    if (!hasTaskFk) {
      await queryRunner.query(`
        ALTER TABLE \`task_deadline_reminders\`
        ADD CONSTRAINT \`FK_task_deadline_reminders_task\`
        FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`)
        ON DELETE CASCADE ON UPDATE NO ACTION
      `);
    }

    const hasRecipientFk = reminderTable?.foreignKeys.some(
      (foreignKey) => foreignKey.name === 'FK_task_deadline_reminders_recipient',
    );
    if (!hasRecipientFk) {
      await queryRunner.query(`
        ALTER TABLE \`task_deadline_reminders\`
        ADD CONSTRAINT \`FK_task_deadline_reminders_recipient\`
        FOREIGN KEY (\`recipient_user_id\`) REFERENCES \`users\`(\`id\`)
        ON DELETE CASCADE ON UPDATE NO ACTION
      `);
    }

    const hasOrganizationFk = reminderTable?.foreignKeys.some(
      (foreignKey) =>
        foreignKey.name === 'FK_task_deadline_reminders_organization',
    );
    if (!hasOrganizationFk) {
      await queryRunner.query(`
        ALTER TABLE \`task_deadline_reminders\`
        ADD CONSTRAINT \`FK_task_deadline_reminders_organization\`
        FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\`(\`id\`)
        ON DELETE SET NULL ON UPDATE NO ACTION
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasReminderTable = await queryRunner.hasTable(
      'task_deadline_reminders',
    );
    if (hasReminderTable) {
      const reminderTable = await queryRunner.getTable('task_deadline_reminders');
      const organizationFk = reminderTable?.foreignKeys.find(
        (foreignKey) =>
          foreignKey.name === 'FK_task_deadline_reminders_organization',
      );
      if (organizationFk) {
        await queryRunner.query(
          'ALTER TABLE `task_deadline_reminders` DROP FOREIGN KEY `FK_task_deadline_reminders_organization`',
        );
      }

      const recipientFk = reminderTable?.foreignKeys.find(
        (foreignKey) =>
          foreignKey.name === 'FK_task_deadline_reminders_recipient',
      );
      if (recipientFk) {
        await queryRunner.query(
          'ALTER TABLE `task_deadline_reminders` DROP FOREIGN KEY `FK_task_deadline_reminders_recipient`',
        );
      }

      const taskFk = reminderTable?.foreignKeys.find(
        (foreignKey) => foreignKey.name === 'FK_task_deadline_reminders_task',
      );
      if (taskFk) {
        await queryRunner.query(
          'ALTER TABLE `task_deadline_reminders` DROP FOREIGN KEY `FK_task_deadline_reminders_task`',
        );
      }

      await queryRunner.query('DROP TABLE `task_deadline_reminders`');
    }

    const hasSettingsTable = await queryRunner.hasTable('organization_settings');
    if (hasSettingsTable) {
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
}
