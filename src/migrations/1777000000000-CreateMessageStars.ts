import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateMessageStars1777000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existingTable = await queryRunner.getTable('message_stars');
    if (existingTable) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'message_stars',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'message_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'user_id',
            type: 'bigint',
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

    await queryRunner.createIndex(
      'message_stars',
      new TableIndex({
        name: 'IDX_message_stars_message_user',
        columnNames: ['message_id', 'user_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKeys('message_stars', [
      new TableForeignKey({
        columnNames: ['message_id'],
        referencedTableName: 'messages',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
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
    const table = await queryRunner.getTable('message_stars');
    if (!table) {
      return;
    }

    for (const foreignKey of table.foreignKeys) {
      await queryRunner.dropForeignKey('message_stars', foreignKey);
    }

    const messageUserIndex = table.indices.find(
      (index) => index.name === 'IDX_message_stars_message_user',
    );
    if (messageUserIndex) {
      await queryRunner.dropIndex('message_stars', messageUserIndex);
    }

    await queryRunner.dropTable('message_stars');
  }
}
