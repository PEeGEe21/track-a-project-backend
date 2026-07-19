import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkflowStepAssigneeIds1788840000000
  implements MigrationInterface
{
  name = 'AddWorkflowStepAssigneeIds1788840000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `workflow_steps` ADD `source_assignee_ids` text NULL',
    );
    await queryRunner.query(
      'UPDATE `workflow_steps` SET `source_assignee_ids` = JSON_ARRAY(`source_assignee_id`) WHERE `source_assignee_id` IS NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `workflow_steps` DROP COLUMN `source_assignee_ids`',
    );
  }
}
