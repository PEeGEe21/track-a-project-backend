import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectMemberRoles1788780000000 implements MigrationInterface {
  name = 'AddProjectMemberRoles1788780000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE project_peers ADD role enum ('viewer','contributor','editor','owner') NOT NULL DEFAULT 'editor' AFTER is_confirmed");
    await queryRunner.query("ALTER TABLE project_peer_invites ADD role enum ('viewer','contributor','editor','owner') NOT NULL DEFAULT 'editor' AFTER status");
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE project_peer_invites DROP COLUMN role');
    await queryRunner.query('ALTER TABLE project_peers DROP COLUMN role');
  }
}
