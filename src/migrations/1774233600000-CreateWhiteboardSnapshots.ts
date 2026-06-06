import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class CreateWhiteboardSnapshots1774233600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'whiteboard_snapshots';
    let existingTable = await queryRunner.getTable(tableName);

    if (!existingTable) {
      await queryRunner.createTable(
        new Table({
          name: tableName,
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              default: '(UUID())',
            },
            {
              name: 'whiteboard_record_id',
              type: 'varchar',
              length: '36',
              isNullable: false,
            },
            {
              name: 'whiteboardId',
              type: 'varchar',
              isNullable: false,
            },
            {
              name: 'project_id',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'created_by',
              type: 'bigint',
              isNullable: true,
            },
            {
              name: 'title',
              type: 'varchar',
              isNullable: true,
            },
            {
              name: 'description',
              type: 'varchar',
              isNullable: true,
            },
            {
              name: 'thumbnail',
              type: 'longtext',
              isNullable: true,
            },
            {
              name: 'elements',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'appState',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'files',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'source',
              type: 'varchar',
              default: "'manual_save'",
            },
            {
              name: 'organization_id',
              type: 'varchar',
              length: '36',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
      );
      existingTable = await queryRunner.getTable(tableName);
    }

    if (!existingTable) {
      return;
    }

    const createdByColumn = existingTable.findColumnByName('created_by');
    if (createdByColumn && createdByColumn.type !== 'bigint') {
      await queryRunner.changeColumn(
        tableName,
        createdByColumn,
        new TableColumn({
          ...createdByColumn,
          type: 'bigint',
          isNullable: true,
        }),
      );
      existingTable = await queryRunner.getTable(tableName);
    }

    const foreignKeys = [
      {
        column: 'whiteboard_record_id',
        referencedTableName: 'whiteboards',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      },
      {
        column: 'project_id',
        referencedTableName: 'projects',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      },
      {
        column: 'created_by',
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      },
      {
        column: 'organization_id',
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      },
    ];

    for (const foreignKey of foreignKeys) {
      const hasForeignKey = existingTable?.foreignKeys.some(
        (key) =>
          key.columnNames.length === 1 &&
          key.columnNames[0] === foreignKey.column &&
          key.referencedTableName === foreignKey.referencedTableName,
      );

      if (!hasForeignKey) {
        await queryRunner.createForeignKey(
          tableName,
          new TableForeignKey({
            columnNames: [foreignKey.column],
            referencedTableName: foreignKey.referencedTableName,
            referencedColumnNames: foreignKey.referencedColumnNames,
            onDelete: foreignKey.onDelete,
          }),
        );
        existingTable = await queryRunner.getTable(tableName);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const existingTable = await queryRunner.getTable('whiteboard_snapshots');
    if (!existingTable) {
      return;
    }

    await queryRunner.dropTable('whiteboard_snapshots');
  }
}
