import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserProjectSidebarPins1788870000000
  implements MigrationInterface
{
  name = 'CreateUserProjectSidebarPins1788870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`user_project_sidebar_pins\` (
        \`id\` varchar(36) NOT NULL,
        \`organization_id\` varchar(36) NOT NULL,
        \`user_id\` bigint NOT NULL,
        \`project_id\` int NOT NULL,
        \`position\` int NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT \`CHK_sidebar_pin_position\` CHECK (\`position\` >= 0),
        CONSTRAINT \`UQ_sidebar_pin_org_user_project\` UNIQUE (\`organization_id\`, \`user_id\`, \`project_id\`),
        INDEX \`IDX_sidebar_pin_org_user_position\` (\`organization_id\`, \`user_id\`, \`position\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_sidebar_pin_organization\` FOREIGN KEY (\`organization_id\`) REFERENCES \`organizations\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_sidebar_pin_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_sidebar_pin_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `user_project_sidebar_pins`');
  }
}
