import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddChatParticipantPreferencesAndClientMessageId1776000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const messagesTable = await queryRunner.getTable('messages');
    if (messagesTable) {
      const clientMessageIdColumn =
        messagesTable.findColumnByName('client_message_id');

      if (!clientMessageIdColumn) {
        await queryRunner.addColumn(
          'messages',
          new TableColumn({
            name: 'client_message_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          }),
        );
      }

      const senderClientIndex = messagesTable.indices.find(
        (index) => index.name === 'IDX_messages_sender_client_message_id',
      );

      if (!senderClientIndex) {
        await queryRunner.createIndex(
          'messages',
          new TableIndex({
            name: 'IDX_messages_sender_client_message_id',
            columnNames: ['senderId', 'client_message_id'],
            isUnique: true,
          }),
        );
      }
    }

    const participantsTable = await queryRunner.getTable(
      'conversation_participants',
    );
    if (!participantsTable) {
      return;
    }

    const columns = [
      new TableColumn({
        name: 'isPinned',
        type: 'tinyint',
        width: 1,
        default: 0,
      }),
      new TableColumn({
        name: 'pinnedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'isArchived',
        type: 'tinyint',
        width: 1,
        default: 0,
      }),
      new TableColumn({
        name: 'archivedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'isDeleted',
        type: 'tinyint',
        width: 1,
        default: 0,
      }),
      new TableColumn({
        name: 'deletedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'lastReadMessageId',
        type: 'varchar',
        length: '36',
        isNullable: true,
      }),
      new TableColumn({
        name: 'draft',
        type: 'text',
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      const existingColumn = participantsTable.findColumnByName(column.name);
      if (!existingColumn) {
        await queryRunner.addColumn('conversation_participants', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const participantsTable = await queryRunner.getTable(
      'conversation_participants',
    );

    if (participantsTable) {
      for (const columnName of [
        'draft',
        'lastReadMessageId',
        'deletedAt',
        'isDeleted',
        'archivedAt',
        'isArchived',
        'pinnedAt',
        'isPinned',
      ]) {
        const existingColumn = participantsTable.findColumnByName(columnName);
        if (existingColumn) {
          await queryRunner.dropColumn('conversation_participants', columnName);
        }
      }
    }

    const messagesTable = await queryRunner.getTable('messages');
    if (!messagesTable) {
      return;
    }

    const senderClientIndex = messagesTable.indices.find(
      (index) => index.name === 'IDX_messages_sender_client_message_id',
    );
    if (senderClientIndex) {
      await queryRunner.dropIndex('messages', senderClientIndex);
    }

    const clientMessageIdColumn =
      messagesTable.findColumnByName('client_message_id');
    if (clientMessageIdColumn) {
      await queryRunner.dropColumn('messages', clientMessageIdColumn);
    }
  }
}
