import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOrganizationFeatureOverrides1788720000000
  implements MigrationInterface
{
  name = 'AddOrganizationFeatureOverrides1788720000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('organization_settings');
    if (table && !table.findColumnByName('feature_overrides')) {
      await queryRunner.addColumn(
        table,
        new TableColumn({
          name: 'feature_overrides',
          type: 'json',
          isNullable: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('organization_settings');
    if (table?.findColumnByName('feature_overrides')) {
      await queryRunner.dropColumn(table, 'feature_overrides');
    }
  }
}
