import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshSessions1789700000000 implements MigrationInterface {
  name = 'CreateRefreshSessions1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `refresh_sessions` (`id` varchar(36) NOT NULL, `jti` varchar(36) NOT NULL, `family_id` varchar(36) NOT NULL, `user_id` bigint NOT NULL, `organization_id` varchar(36) NULL, `expires_at` datetime NOT NULL, `revoked_at` datetime NULL, `replaced_by_jti` varchar(36) NULL, `reuse_detected_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX `IDX_refresh_sessions_jti` (`jti`), INDEX `IDX_refresh_sessions_family_active` (`family_id`, `revoked_at`), INDEX `IDX_refresh_sessions_user` (`user_id`), PRIMARY KEY (`id`), CONSTRAINT `FK_refresh_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE, CONSTRAINT `FK_refresh_sessions_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `refresh_sessions`');
  }
}
