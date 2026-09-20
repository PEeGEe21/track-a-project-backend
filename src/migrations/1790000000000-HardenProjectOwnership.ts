import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenProjectOwnership1790000000000 implements MigrationInterface {
  name = 'HardenProjectOwnership1790000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`project_peers\` keeper
       INNER JOIN (
         SELECT
           MIN(\`id\`) AS keeper_id,
           \`project_id\`,
           \`user_id\`,
           MAX(\`is_confirmed\`) AS is_confirmed,
           MAX(CASE WHEN \`status\` = 'connected' THEN 1 ELSE 0 END) AS has_connected,
           MAX(CASE WHEN \`role\` = 'owner' THEN 4 WHEN \`role\` = 'editor' THEN 3 WHEN \`role\` = 'contributor' THEN 2 ELSE 1 END) AS role_rank
         FROM \`project_peers\`
         GROUP BY \`project_id\`, \`user_id\`
         HAVING COUNT(*) > 1
       ) duplicates ON duplicates.keeper_id = keeper.\`id\`
       SET keeper.\`is_confirmed\` = duplicates.is_confirmed,
           keeper.\`status\` = CASE WHEN duplicates.has_connected = 1 THEN 'connected' ELSE keeper.\`status\` END,
           keeper.\`role\` = CASE duplicates.role_rank WHEN 4 THEN 'owner' WHEN 3 THEN 'editor' WHEN 2 THEN 'contributor' ELSE 'viewer' END`,
    );
    await queryRunner.query(
      `DELETE duplicate FROM \`project_peers\` duplicate
       INNER JOIN \`project_peers\` keeper
         ON duplicate.\`project_id\` = keeper.\`project_id\`
        AND duplicate.\`user_id\` = keeper.\`user_id\`
        AND duplicate.\`id\` > keeper.\`id\``,
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX `UQ_project_peers_project_user` ON `project_peers` (`project_id`, `user_id`)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX `UQ_project_peers_project_user` ON `project_peers`',
    );
  }
}
