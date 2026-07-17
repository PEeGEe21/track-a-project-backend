import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class CascadeProjectOwnedRecords1788750000000
  implements MigrationInterface
{
  name = 'CascadeProjectOwnedRecords1788750000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ TABLE_NAME: string }> = await queryRunner.query(
      `SELECT DISTINCT TABLE_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND REFERENCED_TABLE_NAME = 'projects'`,
    );

    for (const { TABLE_NAME: tableName } of rows) {
      const table = await queryRunner.getTable(tableName);
      if (!table) continue;

      const projectKeys = table.foreignKeys.filter(
        (key) => key.referencedTableName === 'projects',
      );
      for (const key of projectKeys) {
        if (key.onDelete === 'CASCADE') continue;
        await queryRunner.dropForeignKey(table, key);
        await queryRunner.createForeignKey(
          table,
          new TableForeignKey({
            name: key.name,
            columnNames: key.columnNames,
            referencedTableName: key.referencedTableName,
            referencedColumnNames: key.referencedColumnNames,
            onDelete: 'CASCADE',
            onUpdate: key.onUpdate,
          }),
        );
      }
    }
  }

  async down(): Promise<void> {
    // Previous delete rules varied by installation and cannot be restored safely.
    // Reverting this migration intentionally leaves the safer cascade behavior.
  }
}
