import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOnboardingComplete1771230303255 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    const orgTable = await queryRunner.getTable('organizations');
    const userTable = await queryRunner.getTable('users');

    if (!orgTable?.findColumnByName('onboarding_complete')) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'onboarding_complete',
          type: 'boolean',
          default: false,
        }),
      );
    }

    if (!userTable?.findColumnByName('onboarding_complete')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'onboarding_complete',
          type: 'boolean',
          default: false,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.dropColumn('organizations', 'onboarding_complete');
    await queryRunner.dropColumn('users', 'onboarding_complete');
  }
}
