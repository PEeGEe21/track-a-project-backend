import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoundToUserNotificationPreferences1783000000000
  implements MigrationInterface
{
  name = 'AddSoundToUserNotificationPreferences1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user_notification_preferences` ADD `sound` tinyint NOT NULL DEFAULT 1',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user_notification_preferences` DROP COLUMN `sound`',
    );
  }
}
