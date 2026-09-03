import { QueryRunner } from 'typeorm';
import { GeneralizeAuditLogs1789100000000 } from '../migrations/1789100000000-GeneralizeAuditLogs';

describe('GeneralizeAuditLogs1789100000000', () => {
  it('backfills legacy identity before enabling indexes and immutability', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const hasColumn = jest.fn().mockResolvedValue(false);
    const migration = new GeneralizeAuditLogs1789100000000();

    await migration.up({ query, hasColumn } as unknown as QueryRunner);

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements).toHaveLength(7);
    expect(hasColumn).toHaveBeenCalledTimes(19);
    expect(statements[0]).toContain('ADD COLUMN `schema_version`');
    expect(statements[1]).toContain('`schema_version` = 1');
    expect(statements[1]).toContain('`correlation_id` = `id`');
    expect(statements[1]).toContain('`occurred_at` = `created_at`');
    expect(statements[3]).toContain('UQ_audit_source_event');
    expect(statements[5]).toContain('TRG_audit_logs_block_update');
    expect(statements[5]).not.toContain('tailpoint_audit_retention_worker');
    expect(statements[6]).toContain('tailpoint_audit_retention_worker');
  });

  it('does not re-add preserved columns during a down/up rehearsal', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const hasColumn = jest.fn().mockResolvedValue(true);
    const migration = new GeneralizeAuditLogs1789100000000();

    await migration.up({ query, hasColumn } as unknown as QueryRunner);

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(hasColumn).toHaveBeenCalledTimes(19);
    expect(statements).toHaveLength(6);
    expect(statements.join(' ')).not.toContain('ADD COLUMN');
    expect(statements[0]).toContain('`schema_version` = 1');
  });

  it('removes enforcement and indexes without dropping generalized columns', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new GeneralizeAuditLogs1789100000000();

    await migration.down({ query } as unknown as QueryRunner);

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements).toHaveLength(5);
    expect(statements.join(' ')).not.toContain('DROP COLUMN');
    expect(statements[0]).toContain('TRG_audit_logs_block_delete');
    expect(statements[4]).toContain('UQ_audit_source_event');
  });
});
