import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateUserPushSubscriptions1782000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existingTable = await queryRunner.getTable('user_push_subscriptions');
    if (existingTable) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'user_push_subscriptions',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'user_id',
            type: 'bigint',
          },
          {
            name: 'endpoint',
            type: 'varchar',
            length: '1024',
          },
          {
            name: 'endpoint_hash',
            type: 'char',
            length: '64',
          },
          {
            name: 'p256dh',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'auth',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'expiration_time',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'varchar',
            length: '512',
            isNullable: true,
          },
          {
            name: 'last_seen_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'user_push_subscriptions',
      new TableIndex({
        name: 'IDX_user_push_subscriptions_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'user_push_subscriptions',
      new TableIndex({
        name: 'IDX_user_push_subscriptions_endpoint_hash',
        columnNames: ['endpoint_hash'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'user_push_subscriptions',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_push_subscriptions');
    if (!table) {
      return;
    }

    for (const foreignKey of table.foreignKeys) {
      await queryRunner.dropForeignKey('user_push_subscriptions', foreignKey);
    }

    const userIndex = table.indices.find(
      (index) => index.name === 'IDX_user_push_subscriptions_user_id',
    );
    if (userIndex) {
      await queryRunner.dropIndex('user_push_subscriptions', userIndex);
    }

    const endpointIndex = table.indices.find(
      (index) => index.name === 'IDX_user_push_subscriptions_endpoint_hash',
    );
    if (endpointIndex) {
      await queryRunner.dropIndex('user_push_subscriptions', endpointIndex);
    }

    await queryRunner.dropTable('user_push_subscriptions');
  }
}
