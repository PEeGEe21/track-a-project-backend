import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateSavedTaskViews1788730000000 implements MigrationInterface {
  name = 'CreateSavedTaskViews1788730000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('saved_task_views')) return;

    await queryRunner.createTable(
      new Table({
        name: 'saved_task_views',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'organization_id',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'owner_id',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'scope',
            type: 'varchar',
            length: '40',
            default: "'personal_productivity'",
            isNullable: false,
          },
          {
            name: 'configuration',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'visibility',
            type: 'enum',
            enum: ['private', 'organization'],
            default: "'private'",
            isNullable: false,
          },
          {
            name: 'is_default',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'saved_task_views',
      new TableIndex({
        name: 'IDX_saved_task_views_org_owner',
        columnNames: ['organization_id', 'owner_id'],
      }),
    );

    await queryRunner.createForeignKeys('saved_task_views', [
      new TableForeignKey({
        name: 'FK_saved_task_views_organization',
        columnNames: ['organization_id'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_saved_task_views_owner',
        columnNames: ['owner_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('saved_task_views'))) return;

    await queryRunner.dropTable('saved_task_views', true);
  }
}
