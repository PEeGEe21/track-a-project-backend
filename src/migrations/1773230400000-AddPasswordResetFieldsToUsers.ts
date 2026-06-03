import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPasswordResetFieldsToUsers1773230400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const usersTable = await queryRunner.getTable('users');
    if (!usersTable) {
      return;
    }

    if (!usersTable.findColumnByName('password_reset_otp')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'password_reset_otp',
          type: 'varchar',
          length: '6',
          isNullable: true,
        }),
      );
    }

    if (!usersTable.findColumnByName('password_reset_otp_expires_at')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'password_reset_otp_expires_at',
          type: 'timestamp',
          isNullable: true,
        }),
      );
    }

    if (!usersTable.findColumnByName('password_reset_verified_at')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'password_reset_verified_at',
          type: 'timestamp',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const usersTable = await queryRunner.getTable('users');
    if (!usersTable) {
      return;
    }

    if (usersTable.findColumnByName('password_reset_verified_at')) {
      await queryRunner.dropColumn('users', 'password_reset_verified_at');
    }

    if (usersTable.findColumnByName('password_reset_otp_expires_at')) {
      await queryRunner.dropColumn('users', 'password_reset_otp_expires_at');
    }

    if (usersTable.findColumnByName('password_reset_otp')) {
      await queryRunner.dropColumn('users', 'password_reset_otp');
    }
  }
}
