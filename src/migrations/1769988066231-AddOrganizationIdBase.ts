import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOrganizationIdBase1769988066231 implements MigrationInterface {
  // IMPORTANT
  transaction = false;

  private tables = [
    'projects',
    'tasks',
    'notes',
    'whiteboards',
    'documents',
    'resources',
    'project_activities',
    'project_comments',
    'conversations',
    'conversation_participants',
    'messages',
    'project_peers',
    'document_files',
    'folders',
    'notifications',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [org] = await queryRunner.query(`
      SELECT id FROM organizations WHERE slug = 'default-org' LIMIT 1
    `);

    if (!org) {
      throw new Error('❌ default-org does not exist');
    }

    const defaultOrgId = org.id;

    for (const table of this.tables) {
      const exists = await this.tableExists(queryRunner, table);
      if (!exists) continue;

      const hasColumn = await this.columnExists(
        queryRunner,
        table,
        'organization_id',
      );

      if (!hasColumn) {
        await queryRunner.addColumn(
          table,
          new TableColumn({
            name: 'organization_id',
            type: 'varchar',
            length: '36',
            isNullable: true,
          }),
        );
      }

      // HARD DEFAULT — NO LOGIC
      await queryRunner.query(`
        UPDATE ${table}
        SET organization_id = '${defaultOrgId}'
        WHERE organization_id IS NULL
      `);
    }
  }

  public async down(): Promise<void> {
    // intentionally empty (legacy safety)
  }

  private async tableExists(qr: QueryRunner, table: string): Promise<boolean> {
    const r = await qr.query(`
      SELECT COUNT(*) c FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'
    `);
    return r[0].c > 0;
  }

  private async columnExists(
    qr: QueryRunner,
    table: string,
    col: string,
  ): Promise<boolean> {
    const r = await qr.query(`
      SELECT COUNT(*) c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '${table}'
        AND COLUMN_NAME = '${col}'
    `);
    return r[0].c > 0;
  }
}
