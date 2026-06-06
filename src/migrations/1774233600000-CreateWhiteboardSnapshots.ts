import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateWhiteboardSnapshots1774233600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existingTable = await queryRunner.getTable('whiteboard_snapshots');
    if (existingTable) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'whiteboard_snapshots',
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
            type: 'int',
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

    await queryRunner.createForeignKeys('whiteboard_snapshots', [
      new TableForeignKey({
        columnNames: ['whiteboard_record_id'],
        referencedTableName: 'whiteboards',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['project_id'],
        referencedTableName: 'projects',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['organization_id'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const existingTable = await queryRunner.getTable('whiteboard_snapshots');
    if (!existingTable) {
      return;
    }

    await queryRunner.dropTable('whiteboard_snapshots');
  }
}
