import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AllowDeletingTasksWithNotes1788920000000
  implements MigrationInterface
{
  name = 'AllowDeletingTasksWithNotes1788920000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const notes = await queryRunner.getTable('notes');
    const taskKey = notes?.foreignKeys.find(
      (key) =>
        key.columnNames.includes('task_id') &&
        key.referencedTableName === 'tasks',
    );

    if (!notes || !taskKey || taskKey.onDelete === 'SET NULL') return;

    await queryRunner.dropForeignKey(notes, taskKey);
    await queryRunner.createForeignKey(
      notes,
      new TableForeignKey({
        name: taskKey.name,
        columnNames: taskKey.columnNames,
        referencedTableName: taskKey.referencedTableName,
        referencedColumnNames: taskKey.referencedColumnNames,
        onDelete: 'SET NULL',
        onUpdate: taskKey.onUpdate,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const notes = await queryRunner.getTable('notes');
    const taskKey = notes?.foreignKeys.find(
      (key) =>
        key.columnNames.includes('task_id') &&
        key.referencedTableName === 'tasks',
    );

    if (!notes || !taskKey || taskKey.onDelete === 'NO ACTION') return;

    await queryRunner.dropForeignKey(notes, taskKey);
    await queryRunner.createForeignKey(
      notes,
      new TableForeignKey({
        name: taskKey.name,
        columnNames: taskKey.columnNames,
        referencedTableName: taskKey.referencedTableName,
        referencedColumnNames: taskKey.referencedColumnNames,
        onDelete: 'NO ACTION',
        onUpdate: taskKey.onUpdate,
      }),
    );
  }
}
