import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAudioFieldsToNotes1788700000000
  implements MigrationInterface
{
  name = 'AddAudioFieldsToNotes1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasAudioUrl = await queryRunner.hasColumn('notes', 'audio_url');
    if (!hasAudioUrl) {
      await queryRunner.query(
        'ALTER TABLE `notes` ADD COLUMN `audio_url` text NULL',
      );
    }

    const hasAudioPath = await queryRunner.hasColumn('notes', 'audio_path');
    if (!hasAudioPath) {
      await queryRunner.query(
        'ALTER TABLE `notes` ADD COLUMN `audio_path` text NULL',
      );
    }

    const hasAudioMimeType = await queryRunner.hasColumn(
      'notes',
      'audio_mime_type',
    );
    if (!hasAudioMimeType) {
      await queryRunner.query(
        'ALTER TABLE `notes` ADD COLUMN `audio_mime_type` varchar(120) NULL',
      );
    }

    const hasAudioDuration = await queryRunner.hasColumn(
      'notes',
      'audio_duration_seconds',
    );
    if (!hasAudioDuration) {
      await queryRunner.query(
        'ALTER TABLE `notes` ADD COLUMN `audio_duration_seconds` int NULL',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasAudioDuration = await queryRunner.hasColumn(
      'notes',
      'audio_duration_seconds',
    );
    if (hasAudioDuration) {
      await queryRunner.query(
        'ALTER TABLE `notes` DROP COLUMN `audio_duration_seconds`',
      );
    }

    const hasAudioMimeType = await queryRunner.hasColumn(
      'notes',
      'audio_mime_type',
    );
    if (hasAudioMimeType) {
      await queryRunner.query(
        'ALTER TABLE `notes` DROP COLUMN `audio_mime_type`',
      );
    }

    const hasAudioPath = await queryRunner.hasColumn('notes', 'audio_path');
    if (hasAudioPath) {
      await queryRunner.query('ALTER TABLE `notes` DROP COLUMN `audio_path`');
    }

    const hasAudioUrl = await queryRunner.hasColumn('notes', 'audio_url');
    if (hasAudioUrl) {
      await queryRunner.query('ALTER TABLE `notes` DROP COLUMN `audio_url`');
    }
  }
}
