import { AutomationEvent } from 'src/typeorm/entities/AutomationEvent';
import { AutomationConditionOperator } from './automation-contract';
import { AutomationEngineService } from './automation-engine.service';

describe('AutomationEngineService', () => {
  const repository: any = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
  };
  const dataSource = {
    getRepository: jest.fn(() => repository),
    transaction: jest.fn(),
    query: jest.fn(),
  } as any;
  const entitlements = { resolveOrganization: jest.fn() } as any;
  const customFields = { setTaskValuesInTransaction: jest.fn() } as any;
  const events = {} as any;
  const context = { run: jest.fn((_value, callback) => callback()) } as any;
  const notificationsService = {
    deliverCommittedNotification: jest.fn(),
  } as any;
  const projectsGateway = { emitTaskUpdated: jest.fn() } as any;
  let service: AutomationEngineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AutomationEngineService(
      dataSource,
      entitlements,
      customFields,
      events,
      context,
      notificationsService,
      projectsGateway,
      { append: jest.fn(), correlationId: jest.fn() } as any,
    );
  });

  const event = {
    project_id: 4,
    actor_id: '7',
    before_snapshot: {
      task: { priority: 1, statusId: 2, dueDate: '2026-08-11T00:00:00.000Z' },
    },
    after_snapshot: {
      task: {
        priority: 3,
        statusId: 5,
        dueDate: '2026-08-14T00:00:00.000Z',
      },
      customFields: { 'field-a': 'urgent' },
      channel: 'email',
      source: 'api',
      outcome: 'reopened',
      occurrence_count: 3,
    },
  } as unknown as AutomationEvent;

  it.each([
    [
      {
        field: 'priority',
        operator: AutomationConditionOperator.EQUALS,
        value: 3,
      },
      true,
    ],
    [
      {
        field: 'status_id',
        operator: AutomationConditionOperator.IN,
        value: [4, 5],
      },
      true,
    ],
    [
      {
        field: 'priority',
        operator: AutomationConditionOperator.GREATER_THAN,
        value: 2,
      },
      true,
    ],
    [
      {
        field: 'due_date',
        operator: AutomationConditionOperator.LESS_THAN,
        value: '2026-08-20T00:00:00.000Z',
      },
      true,
    ],
    [
      {
        field: 'status_id',
        operator: AutomationConditionOperator.CHANGED_FROM,
        value: 2,
      },
      true,
    ],
    [
      {
        field: 'custom:field-a',
        operator: AutomationConditionOperator.EQUALS,
        value: 'urgent',
      },
      true,
    ],
    [
      {
        field: 'actor_id',
        operator: AutomationConditionOperator.NOT_EQUALS,
        value: 7,
      },
      false,
    ],
    [
      {
        field: 'channel',
        operator: AutomationConditionOperator.EQUALS,
        value: 'email',
      },
      true,
    ],
    [
      {
        field: 'source',
        operator: AutomationConditionOperator.IN,
        value: ['api', 'sdk'],
      },
      true,
    ],
    [
      {
        field: 'outcome',
        operator: AutomationConditionOperator.EQUALS,
        value: 'reopened',
      },
      true,
    ],
    [
      {
        field: 'occurrence_count',
        operator: AutomationConditionOperator.GREATER_THAN,
        value: 2,
      },
      true,
    ],
  ])('evaluates typed condition %#', (condition, expected) => {
    expect((service as any).evaluateCondition(condition, event)).toBe(expected);
  });

  it('claims a queued run once before evaluating it', async () => {
    const run = {
      id: 'run-1',
      state: 'queued',
      attempt_count: 0,
      rule: { active: true },
      rule_version: { definition: { conditions: [], actions: [] } },
      event,
    } as any;
    dataSource.transaction.mockImplementation(async (callback) =>
      callback({ getRepository: () => repository }),
    );
    repository.findOne.mockResolvedValue(run);
    repository.save.mockImplementation(async (value) => value);
    entitlements.resolveOrganization.mockResolvedValue([
      { key: 'rule_based_automation', enabled: false },
    ]);
    await service.executeRun('run-1');
    expect(run.state).toBe('failed');
    expect(run.attempt_count).toBe(1);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failed',
        failure_code: 'terminal:capability_disabled',
      }),
    );
  });

  it('matches a task.ingested event to a published task.ingested rule', async () => {
    const ingestionEvent = {
      id: 'event-ingested',
      organization_id: 'org-1',
      project_id: 4,
      event_type: 'task.ingested',
      occurred_at: new Date('2026-08-16T10:00:00Z'),
      ancestor_rule_ids: [],
      chain_depth: 0,
      action_count: 0,
    } as any;
    const rule = {
      id: 'rule-ingested',
      published_version_id: 'version-ingested',
    } as any;
    const eventQuery: any = {
      where: jest.fn(() => eventQuery),
      andWhere: jest.fn(() => eventQuery),
      orderBy: jest.fn(() => eventQuery),
      take: jest.fn(() => eventQuery),
      getMany: jest.fn().mockResolvedValue([ingestionEvent]),
    };
    const ruleQuery: any = {
      innerJoinAndSelect: jest.fn(() => ruleQuery),
      where: jest.fn(() => ruleQuery),
      andWhere: jest.fn(() => ruleQuery),
      getMany: jest.fn().mockResolvedValue([rule]),
    };
    const insertQuery: any = {
      insert: jest.fn(() => insertQuery),
      into: jest.fn(() => insertQuery),
      values: jest.fn(() => insertQuery),
      orIgnore: jest.fn(() => insertQuery),
      execute: jest.fn().mockResolvedValue({}),
    };
    dataSource.getRepository
      .mockReturnValueOnce({ createQueryBuilder: () => eventQuery })
      .mockReturnValueOnce({ createQueryBuilder: () => ruleQuery });
    dataSource.createQueryBuilder = jest.fn(() => insertQuery);

    await service.matchEvents();

    expect(ruleQuery.andWhere).toHaveBeenCalledWith(
      "JSON_UNQUOTE(JSON_EXTRACT(version.definition, '$.trigger.type')) = :type",
      { type: 'task.ingested' },
    );
    expect(insertQuery.values).toHaveBeenCalledWith(
      expect.objectContaining({
        rule_id: 'rule-ingested',
        rule_version_id: 'version-ingested',
        event_id: 'event-ingested',
        state: 'queued',
      }),
    );
  });

  it('prevents overlapping pollers', async () => {
    (service as any).polling = true;
    await service.poll();
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('accepts a project owner when MySQL returns the bigint ID as a string', async () => {
    const owner = { id: '2', first_name: 'Owner' };
    const manager = {
      getRepository: jest.fn(() => repository),
    } as any;
    repository.findOne.mockResolvedValueOnce({ user: owner });

    await expect(
      (service as any).assertMember(
        manager,
        { project_id: 4, organization_id: 'org-1' },
        2,
      ),
    ).resolves.toBe(owner);
    expect(repository.findOne).toHaveBeenCalledTimes(1);
  });
});
