import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class DistinguishProjectInviteSources1775000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('project_peer_invites');
    if (!table) {
      return;
    }

    const emailColumn = table.findColumnByName('email');
    if (emailColumn && !emailColumn.isNullable) {
      await queryRunner.changeColumn(
        'project_peer_invites',
        'email',
        new TableColumn({
          name: 'email',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }

    const inviteSourceColumn = table.findColumnByName('invite_source');
    if (!inviteSourceColumn) {
      await queryRunner.query(
        "ALTER TABLE `project_peer_invites` ADD `invite_source` ENUM('email','link') NOT NULL DEFAULT 'email'",
      );
    }

    await queryRunner.query(
      "UPDATE `project_peer_invites` SET `invite_source` = 'link' WHERE `email` IS NULL OR TRIM(`email`) = ''",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('project_peer_invites');
    if (!table) {
      return;
    }

    const inviteSourceColumn = table.findColumnByName('invite_source');
    if (inviteSourceColumn) {
      await queryRunner.dropColumn('project_peer_invites', 'invite_source');
    }

    const emailColumn = table.findColumnByName('email');
    if (emailColumn && emailColumn.isNullable) {
      await queryRunner.changeColumn(
        'project_peer_invites',
        'email',
        new TableColumn({
          name: 'email',
          type: 'varchar',
          isNullable: false,
        }),
      );
    }
  }
}
