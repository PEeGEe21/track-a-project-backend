import { Task } from 'src/typeorm/entities/Task';
import { AutomationEventSubscriber } from './automation-event.subscriber';

describe('AutomationEventSubscriber', () => {
  const dataSource = { subscribers: [] } as any;
  const events = {
    taskSnapshot: jest.fn(),
    capture: jest.fn(),
  } as any;
  const executionContext = { current: jest.fn().mockReturnValue(null) } as any;
  const requestContext = {
    currentUserId: jest.fn().mockReturnValue(null),
  } as any;
  const notifications = { deliverCommittedNotification: jest.fn() } as any;

  beforeEach(() => jest.clearAllMocks());

  it('registers once and removes itself when the module closes', () => {
    const subscriber = new AutomationEventSubscriber(
      dataSource,
      events,
      executionContext,
      requestContext,
      notifications,
    );
    expect(dataSource.subscribers).toContain(subscriber);
    subscriber.onModuleDestroy();
    expect(dataSource.subscribers).not.toContain(subscriber);
  });

  it('captures task creation through the insert transaction manager', async () => {
    const subscriber = new AutomationEventSubscriber(
      dataSource,
      events,
      executionContext,
      requestContext,
      notifications,
    );
    const manager = {} as any;
    events.taskSnapshot.mockResolvedValue({ task: { id: 8 } });
    await subscriber.afterInsert({
      metadata: { target: Task },
      manager,
      entity: {
        id: 8,
        organization_id: 'org-1',
        project: { id: 3 },
        user: { id: 2 },
      },
    } as any);
    expect(events.capture).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        eventType: 'task.created',
        dedupeKey: 'task-created:8',
        actorType: 'human',
        actorId: 2,
      }),
    );
    subscriber.onModuleDestroy();
  });

  it('propagates automation causation and ancestry', async () => {
    executionContext.current.mockReturnValueOnce({
      actorId: 'automation-1',
      causationEventId: 'event-1',
      correlationId: 'correlation-1',
      ancestorRuleIds: ['rule-1'],
      chainDepth: 1,
      actionCount: 1,
    });
    const subscriber = new AutomationEventSubscriber(
      dataSource,
      events,
      executionContext,
      requestContext,
      notifications,
    );
    events.taskSnapshot.mockResolvedValue({ task: { id: 8 } });
    await subscriber.afterInsert({
      metadata: { target: Task },
      manager: {},
      entity: {
        id: 8,
        organization_id: 'org-1',
        project: { id: 3 },
      },
    } as any);
    expect(events.capture).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorType: 'automation',
        causationEventId: 'event-1',
        ancestorRuleIds: ['rule-1'],
      }),
    );
    subscriber.onModuleDestroy();
  });

  it('uses the authenticated request user for human attribution', () => {
    requestContext.currentUserId.mockReturnValueOnce(42);
    const subscriber = new AutomationEventSubscriber(
      dataSource,
      events,
      executionContext,
      requestContext,
      notifications,
    );

    expect((subscriber as any).attribution()).toEqual({
      actorType: 'human',
      actorId: 42,
    });
    subscriber.onModuleDestroy();
  });
});
