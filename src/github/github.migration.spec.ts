import { GithubIntegration1789900000000 } from 'src/migrations/1789900000000-GithubIntegration';
import { GithubLinkHardening1789910000000 } from 'src/migrations/1789910000000-GithubLinkHardening';
import { GithubProjectActivityIndexes1790100000000 } from 'src/migrations/1790100000000-GithubProjectActivityIndexes';

describe('GithubIntegration migration', () => {
  it('creates all durable GitHub tables and uniqueness constraints', async () => {
    const queries: string[] = [];
    await new GithubIntegration1789900000000().up({
      query: jest.fn(async (sql: string) => queries.push(sql)),
    } as any);
    const sql = queries.join('\n');
    expect(sql).toContain('github_connections');
    expect(sql).toContain('github_deliveries');
    expect(sql).toContain('github_artifacts');
    expect(sql).toContain('github_task_links');
    expect(sql).toContain('UQ_github_delivery_provider');
    expect(sql).toContain('UQ_github_task_artifact');
    expect(sql).toContain('UQ_github_connection_project_repo');
    expect(sql).toContain('UQ_github_connection_provider_repo');
    expect(sql).toContain('provider_updated_at');
    expect(sql).toContain(
      'FOREIGN KEY (`connection_id`) REFERENCES `github_connections`(`id`) ON DELETE CASCADE',
    );
    expect(sql).toContain(
      'FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE',
    );
  });
  it('drops children before parents', async () => {
    const queries: string[] = [];
    await new GithubIntegration1789900000000().down({
      query: jest.fn(async (sql: string) => queries.push(sql)),
    } as any);
    expect(queries).toEqual([
      'DROP TABLE `github_task_links`',
      'DROP TABLE `github_artifacts`',
      'DROP TABLE `github_deliveries`',
      'DROP TABLE `github_connections`',
    ]);
  });
});

describe('GithubLinkHardening migration', () => {
  it('adds durable provenance, manual suppression, and diagnostics', async () => {
    const queries: string[] = [];
    await new GithubLinkHardening1789910000000().up({
      query: jest.fn(async (sql: string) => queries.push(sql)),
    } as any);
    const sql = queries.join('\n');
    expect(sql).toContain('manually_overridden');
    expect(sql).toContain('source_artifact_id');
    expect(sql).toContain('github_link_diagnostics');
    expect(sql).toContain('UQ_github_link_diagnostic_delivery_token');
  });
});

describe('GithubProjectActivityIndexes migration', () => {
  it('adds reversible project feed and link lookup indexes', async () => {
    const queries: string[] = [];
    const runner = { query: jest.fn(async (sql: string) => queries.push(sql)) };
    const migration = new GithubProjectActivityIndexes1790100000000();
    await migration.up(runner as any);
    expect(queries.join('\n')).toContain('IDX_github_artifact_project_activity');
    expect(queries.join('\n')).toContain('IDX_github_task_link_artifact_state');
    queries.length = 0;
    await migration.down(runner as any);
    expect(queries.join('\n')).toContain('DROP INDEX `IDX_github_artifact_project_activity`');
  });
});
