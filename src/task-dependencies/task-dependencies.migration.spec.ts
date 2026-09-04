import { TaskDependencies1789400000000 } from 'src/migrations/1789400000000-TaskDependencies';

describe('TaskDependencies migration', () => {
  it('creates and drops the dependency ledger', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new TaskDependencies1789400000000();
    await migration.up({ query } as any);
    expect(query.mock.calls[0][0]).toContain(
      'CREATE TABLE `task_dependencies`',
    );
    expect(query.mock.calls[0][0]).toContain('UQ_task_dependency_edge');
    await migration.down({ query } as any);
    expect(query.mock.calls[1][0]).toBe('DROP TABLE `task_dependencies`');
  });
});
