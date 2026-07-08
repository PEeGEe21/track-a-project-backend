import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedProjectStatusTemplates1788710000000
  implements MigrationInterface
{
  name = 'SeedProjectStatusTemplates1788710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('project_status_templates');

    if (!hasTable) {
      return;
    }

    await queryRunner.query(`
      INSERT INTO \`project_status_templates\`
        (\`title\`, \`color\`, \`tab_id\`, \`isActive\`, \`isDefault\`, \`isTerminal\`)
      SELECT * FROM (
        SELECT 'To Do' AS \`title\`, '#94A3B8' AS \`color\`, 0 AS \`tab_id\`, 1 AS \`isActive\`, 1 AS \`isDefault\`, 0 AS \`isTerminal\`
        UNION ALL
        SELECT 'In Progress', '#3B82F6', 1, 1, 1, 0
        UNION ALL
        SELECT 'Review', '#8B5CF6', 2, 1, 1, 0
        UNION ALL
        SELECT 'Done', '#10B981', 3, 1, 1, 1
      ) AS seeded_rows
      WHERE NOT EXISTS (
        SELECT 1 FROM \`project_status_templates\`
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('project_status_templates');

    if (!hasTable) {
      return;
    }

    await queryRunner.query(`
      DELETE FROM \`project_status_templates\`
      WHERE \`title\` IN ('To Do', 'In Progress', 'Review', 'Done')
        AND \`tab_id\` IN (0, 1, 2, 3)
    `);
  }
}
