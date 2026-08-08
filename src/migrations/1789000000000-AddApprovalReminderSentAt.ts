import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalReminderSentAt1789000000000
  implements MigrationInterface
{
  name = 'AddApprovalReminderSentAt1789000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('approval_requests'))) return;
    const table = await queryRunner.getTable('approval_requests');
    if (!table?.findColumnByName('reminder_sent_at')) {
      await queryRunner.query(
        'ALTER TABLE `approval_requests` ADD `reminder_sent_at` datetime NULL AFTER `resolved_at`',
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('approval_requests'))) return;
    const table = await queryRunner.getTable('approval_requests');
    if (table?.findColumnByName('reminder_sent_at')) {
      await queryRunner.query(
        'ALTER TABLE `approval_requests` DROP COLUMN `reminder_sent_at`',
      );
    }
  }
}
