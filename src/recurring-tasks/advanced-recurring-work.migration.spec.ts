import { AdvancedRecurringWork1789500000000 } from 'src/migrations/1789500000000-AdvancedRecurringWork';

describe('Advanced recurring work migration', () => {
  it('adds and reverses advanced recurrence storage', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new AdvancedRecurringWork1789500000000();
    await migration.up({ query } as any);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes('task_recurrence_exceptions'),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some(([sql]) => sql.includes('pending_changes')),
    ).toBe(true);
    await migration.down({ query } as any);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes('DROP TABLE `task_recurrence_exceptions`'),
      ),
    ).toBe(true);
  });
});
