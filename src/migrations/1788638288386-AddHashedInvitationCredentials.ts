import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHashedInvitationCredentials1788638288386
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
    ALTER TABLE organization_invitations
    ADD token_hash varchar(64) NULL
  `);

    await queryRunner.query(`
    UPDATE organization_invitations
    SET token_hash = SHA2(token, 256)
  `);

    await queryRunner.query(`
    ALTER TABLE organization_invitations
    MODIFY token_hash varchar(64) NOT NULL
  `);

    await queryRunner.query(`
    ALTER TABLE organization_invitations
    ADD UNIQUE INDEX IDX_ORG_INVITE_TOKEN_HASH (token_hash)
  `);

    await queryRunner.query(`
    ALTER TABLE organization_invitations
    ADD invite_code_hash varchar(64) NULL
  `);

    await queryRunner.query(`
    ALTER TABLE organization_invitations
    DROP COLUMN token
  `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
