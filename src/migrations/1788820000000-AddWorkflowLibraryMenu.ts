import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkflowLibraryMenu1788820000000 implements MigrationInterface {
  name = 'AddWorkflowLibraryMenu1788820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO `global_menus` (`id`, `label`, `href`, `icon`, `parent_id`, `order_index`, `required_tier`, `is_active`, `is_main`, `created_at`, `updated_at`) SELECT UUID(), 'Workflows', '/workflows', 'workflow', NULL, 11, 'free', 1, 0, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) WHERE NOT EXISTS (SELECT 1 FROM `global_menus` WHERE `label` = 'Workflows')",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE FROM `global_menus` WHERE `label` = 'Workflows' AND `href` = '/workflows'",
    );
  }
}
