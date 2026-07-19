import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkWorkflowDiagrams1788830000000 implements MigrationInterface {
  name = 'LinkWorkflowDiagrams1788830000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `workflow_templates` ADD `diagram_whiteboard_id` varchar(36) NULL',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `workflow_templates` DROP COLUMN `diagram_whiteboard_id`',
    );
  }
}
