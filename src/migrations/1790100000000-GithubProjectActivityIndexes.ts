import { MigrationInterface, QueryRunner } from 'typeorm';

export class GithubProjectActivityIndexes1790100000000
  implements MigrationInterface
{
  name = 'GithubProjectActivityIndexes1790100000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query('CREATE INDEX `IDX_github_artifact_project_activity` ON `github_artifacts` (`organization_id`,`project_id`,`provider_updated_at`,`id`)');
    await q.query('CREATE INDEX `IDX_github_artifact_project_type` ON `github_artifacts` (`organization_id`,`project_id`,`artifact_type`,`provider_updated_at`)');
    await q.query('CREATE INDEX `IDX_github_task_link_artifact_state` ON `github_task_links` (`artifact_id`,`state`,`task_id`)');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX `IDX_github_task_link_artifact_state` ON `github_task_links`');
    await q.query('DROP INDEX `IDX_github_artifact_project_type` ON `github_artifacts`');
    await q.query('DROP INDEX `IDX_github_artifact_project_activity` ON `github_artifacts`');
  }
}
