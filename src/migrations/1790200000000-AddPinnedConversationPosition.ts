import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddPinnedConversationPosition1790200000000
  implements MigrationInterface
{
  name = 'AddPinnedConversationPosition1790200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'conversation_participants',
      new TableColumn({ name: 'pinnedPosition', type: 'int', isNullable: true }),
    );
    const pins: Array<{
      id: string;
      user_id: string;
      organization_id: string | null;
    }> = await queryRunner.query(`
      SELECT id, user_id, organization_id
      FROM conversation_participants
      WHERE isPinned = 1
      ORDER BY user_id, organization_id, pinnedAt, created_at
    `);
    const positions = new Map<string, number>();
    for (const pin of pins) {
      const owner = `${pin.user_id}:${pin.organization_id ?? ''}`;
      const position = positions.get(owner) ?? 0;
      await queryRunner.query(
        'UPDATE conversation_participants SET pinnedPosition = ? WHERE id = ?',
        [position, pin.id],
      );
      positions.set(owner, position + 1);
    }
    await queryRunner.createIndex(
      'conversation_participants',
      new TableIndex({
        name: 'IDX_conversation_participant_sidebar_pins',
        columnNames: ['user_id', 'organization_id', 'isPinned', 'pinnedPosition'],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'conversation_participants',
      'IDX_conversation_participant_sidebar_pins',
    );
    await queryRunner.dropColumn('conversation_participants', 'pinnedPosition');
  }
}
