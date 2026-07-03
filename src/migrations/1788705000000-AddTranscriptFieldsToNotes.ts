import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTranscriptFieldsToNotes1788705000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTranscript = await queryRunner.hasColumn('notes', 'audio_transcript');
    if (!hasTranscript) {
      await queryRunner.query(
        'ALTER TABLE `notes` ADD COLUMN `audio_transcript` text NULL',
      );
    }

    const hasTranscriptStatus = await queryRunner.hasColumn(
      'notes',
      'audio_transcript_status',
    );
    if (!hasTranscriptStatus) {
      await queryRunner.query(
        "ALTER TABLE `notes` ADD COLUMN `audio_transcript_status` varchar(32) NULL",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTranscriptStatus = await queryRunner.hasColumn(
      'notes',
      'audio_transcript_status',
    );
    if (hasTranscriptStatus) {
      await queryRunner.query(
        'ALTER TABLE `notes` DROP COLUMN `audio_transcript_status`',
      );
    }

    const hasTranscript = await queryRunner.hasColumn('notes', 'audio_transcript');
    if (hasTranscript) {
      await queryRunner.query('ALTER TABLE `notes` DROP COLUMN `audio_transcript`');
    }
  }
}
