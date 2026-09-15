import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RepairAdvancedRecurringWork1789800000000
  implements MigrationInterface
{
  name = 'RepairAdvancedRecurringWork1789800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('task_recurrences'))) return;

    const recurrenceColumns: TableColumn[] = [
      new TableColumn({
        name: 'advanced_enabled',
        type: 'tinyint',
        isNullable: false,
        default: 0,
      }),
      new TableColumn({
        name: 'holiday_policy',
        type: 'enum',
        enum: ['none', 'skip', 'next_business_day'],
        isNullable: false,
        default: "'none'",
      }),
      new TableColumn({
        name: 'holiday_dates',
        type: 'json',
        isNullable: true,
      }),
      new TableColumn({
        name: 'assignee_rotation_ids',
        type: 'json',
        isNullable: true,
      }),
      new TableColumn({
        name: 'rotation_index',
        type: 'int',
        isNullable: false,
        default: 0,
      }),
      new TableColumn({
        name: 'last_error_code',
        type: 'varchar',
        length: '80',
        isNullable: true,
      }),
      new TableColumn({
        name: 'consecutive_failures',
        type: 'int',
        isNullable: false,
        default: 0,
      }),
      new TableColumn({
        name: 'pending_changes',
        type: 'json',
        isNullable: true,
      }),
      new TableColumn({
        name: 'changes_effective_at',
        type: 'datetime',
        isNullable: true,
      }),
      new TableColumn({
        name: 'generation_lease_until',
        type: 'datetime',
        precision: 6,
        isNullable: true,
      }),
      new TableColumn({
        name: 'reusable_template_version_id',
        type: 'varchar',
        length: '36',
        isNullable: true,
      }),
    ];

    for (const column of recurrenceColumns) {
      if (!(await queryRunner.hasColumn('task_recurrences', column.name))) {
        await queryRunner.addColumn('task_recurrences', column);
      }
    }

    if (!(await queryRunner.hasTable('task_recurrence_occurrences'))) return;

    const occurrencesTable = await queryRunner.getTable(
      'task_recurrence_occurrences',
    );
    const taskIdColumn = occurrencesTable?.findColumnByName('task_id');
    if (taskIdColumn && !taskIdColumn.isNullable) {
      await queryRunner.query(
        'ALTER TABLE `task_recurrence_occurrences` MODIFY `task_id` int NULL',
      );
    }

    const occurrenceColumns: TableColumn[] = [
      new TableColumn({
        name: 'outcome',
        type: 'varchar',
        length: '20',
        isNullable: false,
        default: "'generated'",
      }),
      new TableColumn({
        name: 'failure_code',
        type: 'varchar',
        length: '80',
        isNullable: true,
      }),
      new TableColumn({
        name: 'resolved_due_at',
        type: 'datetime',
        isNullable: true,
      }),
    ];

    for (const column of occurrenceColumns) {
      if (
        !(await queryRunner.hasColumn(
          'task_recurrence_occurrences',
          column.name,
        ))
      ) {
        await queryRunner.addColumn('task_recurrence_occurrences', column);
      }
    }
  }

  async down(): Promise<void> {
    // This migration reconciles potentially partially-applied production
    // schemas. Rolling it back must not remove columns that may predate it.
  }
}
