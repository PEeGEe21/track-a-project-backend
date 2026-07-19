import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkflowOwnershipConstraints1788850000000
  implements MigrationInterface
{
  name = 'AddWorkflowOwnershipConstraints1788850000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `workflow_templates` ADD CONSTRAINT `FK_workflow_templates_source_project` FOREIGN KEY (`source_project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE `work_conversions` ADD CONSTRAINT `FK_work_conversions_source_project` FOREIGN KEY (`source_project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE `work_conversions` ADD CONSTRAINT `FK_work_conversions_destination_project` FOREIGN KEY (`destination_project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `work_conversions` DROP FOREIGN KEY `FK_work_conversions_destination_project`',
    );
    await queryRunner.query(
      'ALTER TABLE `work_conversions` DROP FOREIGN KEY `FK_work_conversions_source_project`',
    );
    await queryRunner.query(
      'ALTER TABLE `workflow_templates` DROP FOREIGN KEY `FK_workflow_templates_source_project`',
    );
  }
}
