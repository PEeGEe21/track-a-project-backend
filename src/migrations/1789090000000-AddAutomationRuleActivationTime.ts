import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutomationRuleActivationTime1789090000000
  implements MigrationInterface
{
  name = 'AddAutomationRuleActivationTime1789090000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE `automation_rules` ADD `active_since` datetime(6) NULL AFTER `active`, ADD INDEX `IDX_automation_rules_active_since` (`active`,`active_since`)',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE `automation_rules` DROP INDEX `IDX_automation_rules_active_since`, DROP COLUMN `active_since`',
    );
  }
}
