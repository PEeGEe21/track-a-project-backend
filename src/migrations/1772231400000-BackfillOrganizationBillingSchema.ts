import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class BackfillOrganizationBillingSchema1772231400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const orgTable = await queryRunner.getTable('organizations');

    if (orgTable) {
      if (!orgTable.findColumnByName('description')) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'description',
            type: 'longtext',
            isNullable: true,
          }),
        );
      }

      if (!orgTable.findColumnByName('logo')) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'logo',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: "''",
          }),
        );
      }

      if (!orgTable.findColumnByName('subscription_tier')) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'subscription_tier',
            type: 'enum',
            enum: ['free', 'basic', 'professional', 'enterprise'],
            default: "'free'",
          }),
        );
      }

      if (!orgTable.findColumnByName('max_users')) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'max_users',
            type: 'int',
            default: '5',
          }),
        );
      }

      if (!orgTable.findColumnByName('max_projects')) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'max_projects',
            type: 'int',
            default: '10',
          }),
        );
      }

      if (!orgTable.findColumnByName('is_active')) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'is_active',
            type: 'boolean',
            default: true,
          }),
        );
      }

      if (!orgTable.findColumnByName('active_subscription_id')) {
        await queryRunner.addColumn(
          'organizations',
          new TableColumn({
            name: 'active_subscription_id',
            type: 'uuid',
            isNullable: true,
          }),
        );
      }

      const hasActiveSubscriptionIndex = orgTable.indices.some(
        (index) => index.name === 'IDX_organizations_active_subscription_id',
      );

      if (!hasActiveSubscriptionIndex) {
        await queryRunner.createIndex(
          'organizations',
          new TableIndex({
            name: 'IDX_organizations_active_subscription_id',
            columnNames: ['active_subscription_id'],
          }),
        );
      }
    }

    const plansExists = await queryRunner.hasTable('plans');
    if (!plansExists) {
      await queryRunner.createTable(
        new Table({
          name: 'plans',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid()',
            },
            {
              name: 'code',
              type: 'varchar',
              length: '50',
              isUnique: true,
            },
            {
              name: 'name',
              type: 'varchar',
              length: '100',
            },
            {
              name: 'description',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'is_public',
              type: 'boolean',
              default: false,
            },
            {
              name: 'is_active',
              type: 'boolean',
              default: true,
            },
            {
              name: 'display_order',
              type: 'int',
              default: '0',
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
      );
    }

    const pricesExists = await queryRunner.hasTable('prices');
    if (!pricesExists) {
      await queryRunner.createTable(
        new Table({
          name: 'prices',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid()',
            },
            {
              name: 'plan_id',
              type: 'uuid',
            },
            {
              name: 'stripe_price_id',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'interval',
              type: 'enum',
              enum: ['month', 'year', 'one_time'],
              default: "'month'",
            },
            {
              name: 'unit_amount',
              type: 'decimal',
              precision: 10,
              scale: 2,
              default: '0',
            },
            {
              name: 'currency',
              type: 'varchar',
              length: '10',
              default: "'USD'",
            },
            {
              name: 'min_quantity',
              type: 'int',
              default: '1',
            },
            {
              name: 'max_quantity',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'is_active',
              type: 'boolean',
              default: true,
            },
            {
              name: 'notes',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
          foreignKeys: [
            new TableForeignKey({
              columnNames: ['plan_id'],
              referencedTableName: 'plans',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            }),
          ],
        }),
      );
    }

    const subscriptionsExists = await queryRunner.hasTable('subscriptions');
    if (!subscriptionsExists) {
      await queryRunner.createTable(
        new Table({
          name: 'subscriptions',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid()',
            },
            {
              name: 'organization_id',
              type: 'uuid',
            },
            {
              name: 'price_id',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'status',
              type: 'enum',
              enum: [
                'incomplete',
                'incomplete_expired',
                'trialing',
                'active',
                'past_due',
                'canceled',
                'unpaid',
                'paused',
              ],
              default: "'incomplete'",
            },
            {
              name: 'current_period_start',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'current_period_end',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'trial_end',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'cancel_at_period_end',
              type: 'boolean',
              default: false,
            },
            {
              name: 'canceled_at',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'quantity',
              type: 'int',
              default: '1',
            },
            {
              name: 'max_users',
              type: 'int',
              default: '5',
            },
            {
              name: 'max_projects',
              type: 'int',
              default: '10',
            },
            {
              name: 'stripe_subscription_id',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'stripe_customer_id',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'metadata',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
          indices: [
            {
              name: 'IDX_subscriptions_organization_id_status',
              columnNames: ['organization_id', 'status'],
            },
          ],
          foreignKeys: [
            new TableForeignKey({
              columnNames: ['organization_id'],
              referencedTableName: 'organizations',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            }),
            new TableForeignKey({
              columnNames: ['price_id'],
              referencedTableName: 'prices',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
            }),
          ],
        }),
      );
    }

    const invoicesExists = await queryRunner.hasTable('invoices');
    if (!invoicesExists) {
      await queryRunner.createTable(
        new Table({
          name: 'invoices',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid()',
            },
            {
              name: 'organization_id',
              type: 'uuid',
            },
            {
              name: 'subscription_id',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'stripe_invoice_id',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'status',
              type: 'enum',
              enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
              default: "'draft'",
            },
            {
              name: 'amount_due',
              type: 'decimal',
              precision: 10,
              scale: 2,
            },
            {
              name: 'amount_paid',
              type: 'decimal',
              precision: 10,
              scale: 2,
              default: '0',
            },
            {
              name: 'currency',
              type: 'varchar',
              length: '10',
              default: "'USD'",
            },
            {
              name: 'period_start',
              type: 'timestamp',
            },
            {
              name: 'period_end',
              type: 'timestamp',
            },
            {
              name: 'paid_at',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'pdf_url',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'lines',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'metadata',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
          foreignKeys: [
            new TableForeignKey({
              columnNames: ['organization_id'],
              referencedTableName: 'organizations',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            }),
            new TableForeignKey({
              columnNames: ['subscription_id'],
              referencedTableName: 'subscriptions',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
            }),
          ],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('invoices')) {
      await queryRunner.dropTable('invoices');
    }

    if (await queryRunner.hasTable('subscriptions')) {
      await queryRunner.dropTable('subscriptions');
    }

    if (await queryRunner.hasTable('prices')) {
      await queryRunner.dropTable('prices');
    }

    if (await queryRunner.hasTable('plans')) {
      await queryRunner.dropTable('plans');
    }

    const orgTable = await queryRunner.getTable('organizations');
    if (!orgTable) {
      return;
    }

    const activeSubscriptionIndex = orgTable.indices.find(
      (index) => index.name === 'IDX_organizations_active_subscription_id',
    );
    if (activeSubscriptionIndex) {
      await queryRunner.dropIndex(
        'organizations',
        'IDX_organizations_active_subscription_id',
      );
    }

    const columnsToDrop = [
      'active_subscription_id',
      'max_projects',
      'max_users',
      'subscription_tier',
      'logo',
      'description',
    ];

    for (const columnName of columnsToDrop) {
      if (orgTable.findColumnByName(columnName)) {
        await queryRunner.dropColumn('organizations', columnName);
      }
    }
  }
}
