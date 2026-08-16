import { AutomationEventsService } from './automation-events.service';

describe('AutomationEventsService', () => {
  const execute = jest
    .fn()
    .mockResolvedValue({ identifiers: [{ id: 'event' }] });
  const queryBuilder: any = {
    insert: jest.fn(() => queryBuilder),
    into: jest.fn(() => queryBuilder),
    values: jest.fn(() => queryBuilder),
    orIgnore: jest.fn(() => queryBuilder),
    execute,
  };
  const manager = { createQueryBuilder: jest.fn(() => queryBuilder) } as any;
  const dataSource = {
    manager,
    query: jest.fn().mockResolvedValue([]),
  } as any;
  const entitlements = { resolveOrganization: jest.fn() } as any;
  let service: AutomationEventsService;

  beforeEach(() => {
    jest.clearAllMocks();
    entitlements.resolveOrganization.mockResolvedValue([
      { key: 'rule_based_automation', enabled: true },
    ]);
    service = new AutomationEventsService(dataSource, entitlements);
  });

  it('does not retain events while the capability is disabled', async () => {
    entitlements.resolveOrganization.mockResolvedValue([
      { key: 'rule_based_automation', enabled: false },
    ]);
    await expect(
      service.capture(manager, {
        organizationId: 'org-1',
        projectId: 4,
        eventType: 'task.created',
        subjectType: 'task',
        subjectId: 9,
      }),
    ).resolves.toBeNull();
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('writes through the supplied transaction manager with dedupe metadata', async () => {
    await service.capture(manager, {
      organizationId: 'org-1',
      projectId: 4,
      eventType: 'task.created',
      subjectType: 'task',
      subjectId: 9,
      dedupeKey: 'task-created:9',
      actorType: 'human',
      actorId: 2,
      after: { title: 'A'.repeat(1200) },
    });
    expect(queryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        project_id: 4,
        event_type: 'task.created',
        subject_id: '9',
        dedupe_key: 'task-created:9',
        actor_type: 'human',
        actor_id: '2',
        after_snapshot: { title: 'A'.repeat(1000) },
      }),
    );
    expect(queryBuilder.orIgnore).toHaveBeenCalled();
  });

  it('persists a deduplicated task.ingested event and its safe intake fields', async () => {
    await service.capture(manager, {
      organizationId: 'org-1',
      projectId: 4,
      eventType: 'task.ingested',
      subjectType: 'task',
      subjectId: 9,
      dedupeKey: 'task-ingested:7bb83204-11c0-4300-897f-8abbf7b74102',
      actorType: 'system',
      correlationId: '7bb83204-11c0-4300-897f-8abbf7b74102',
      after: {
        channel: 'webhook',
        source: 'api',
        outcome: 'deduped',
        occurrence_count: 2,
      },
    });

    expect(queryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'task.ingested',
        dedupe_key: 'task-ingested:7bb83204-11c0-4300-897f-8abbf7b74102',
        correlation_id: '7bb83204-11c0-4300-897f-8abbf7b74102',
        after_snapshot: {
          channel: 'webhook',
          source: 'api',
          outcome: 'deduped',
          occurrence_count: 2,
        },
      }),
    );
  });

  it('bounds nested snapshots before persistence', async () => {
    const result = (service as any).sanitize({
      values: Array.from({ length: 60 }, (_, index) => index),
      deep: { a: { b: { c: { d: { e: { f: 'hidden' } } } } } },
    });
    expect(result.values).toHaveLength(50);
    expect(JSON.stringify(result)).toContain('[bounded]');
  });

  it('does not overlap deadline scans', async () => {
    (service as any).deadlineScanRunning = true;
    await service.captureReachedDeadlines();
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
