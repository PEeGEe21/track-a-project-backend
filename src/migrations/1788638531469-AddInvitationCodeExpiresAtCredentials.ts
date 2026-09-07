import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvitationCodeExpiresAtCredentials1788638531469
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    ALTER TABLE organization_invitations
    ADD code_expires_at timestamp NULL
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
