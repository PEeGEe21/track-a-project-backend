import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectStatusTemplates1788700000000
  implements MigrationInterface
{
  name = 'CreateProjectStatusTemplates1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`project_status_templates\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`title\` varchar(255) NOT NULL,
        \`color\` varchar(255) NULL,
        \`tab_id\` int NOT NULL DEFAULT 0,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`isDefault\` tinyint NOT NULL DEFAULT 1,
        \`isTerminal\` tinyint NOT NULL DEFAULT 0,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

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
    await queryRunner.query('DROP TABLE IF EXISTS `project_status_templates`');
  }
}
