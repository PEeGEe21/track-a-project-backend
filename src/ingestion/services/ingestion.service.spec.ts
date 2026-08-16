import { HttpException } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { ActivityType } from 'src/utils/constants/activity';

describe('IngestionService', () => {
  const projectActivitiesService = {
    createActivity: jest.fn(),
  };

  const projectRepository = {
    findOne: jest.fn(),
  };

  const taskRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const statusRepository = {
    findOne: jest.fn(),
  };

  const userRepository = {
    findOne: jest.fn(),
  };

  const ingestApiKeyRepository = {
    findOne: jest.fn(),
  };

  const ingestedEventRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const projectIngestionSettingsRepository = {
    findOne: jest.fn(),
  };
  const projectActivityRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const transactionUserRepository = { find: jest.fn() };
  const projectPeerRepository = { find: jest.fn() };
  const dataSource = {
    transaction: jest.fn(),
  };
  const projectsGateway = {
    emitIngestionUpdated: jest.fn(),
  };
  const customWorkflowsService = { transitionTask: jest.fn() };
  const normalizedIntakeService = {
    receive: jest.fn(),
    process: jest.fn(),
  };
  const customFieldsService = {
    setTaskValuesInTransaction: jest.fn(),
  };
  const authorizationService = {
    assertProjectPermission: jest.fn(),
  };
  const automationEventsService = {
    taskSnapshot: jest.fn(),
    capture: jest.fn(),
  };
  const notificationsService = {
    enqueueNotification: jest.fn(),
  };

  let service: IngestionService;

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation(async (callback) =>
      callback({
        getRepository: (entity: any) => {
          if (entity?.name === 'Task') {
            return taskRepository;
          }
          if (entity?.name === 'IngestedEvent') {
            return ingestedEventRepository;
          }
          if (entity?.name === 'ProjectActivity') {
            return projectActivityRepository;
          }
          if (entity?.name === 'User') return transactionUserRepository;
          if (entity?.name === 'ProjectPeer') return projectPeerRepository;
          throw new Error(`Unexpected repository request: ${entity?.name}`);
        },
      }),
    );
    projectActivityRepository.create.mockImplementation((value) => value);
    projectActivityRepository.save.mockImplementation(async (value) => value);
    customWorkflowsService.transitionTask.mockImplementation(
      async (_manager, _actor, _organizationId, task, destinationStatusId) => {
        task.status = { id: destinationStatusId };
        return taskRepository.save(task);
      },
    );
    normalizedIntakeService.receive.mockResolvedValue({
      event: { id: 'event-1', state: 'received' },
      idempotent: false,
    });
    normalizedIntakeService.process.mockImplementation(
      async (event, processor) => ({
        event,
        outcome: await dataSource.transaction(processor),
        idempotent: false,
      }),
    );
    service = new IngestionService(
      projectActivitiesService as any,
      projectsGateway as any,
      customWorkflowsService as any,
      normalizedIntakeService as any,
      customFieldsService as any,
      authorizationService as any,
      automationEventsService as any,
      notificationsService as any,
      projectRepository as any,
      taskRepository as any,
      statusRepository as any,
      userRepository as any,
      ingestApiKeyRepository as any,
      ingestedEventRepository as any,
      projectIngestionSettingsRepository as any,
    );
  });

  it('assigns imported tasks only to active project members resolved by email', async () => {
    const owner = { id: 1, email: 'owner@example.com', is_active: true };
    const member = { id: 2, email: 'member@example.com', is_active: true };
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org-1',
      user: owner,
      default_ingestion_status_id: 3,
    });
    statusRepository.findOne.mockResolvedValue({ id: 3, project: { id: 7 } });
    transactionUserRepository.find.mockResolvedValue([owner, member]);
    projectPeerRepository.find.mockResolvedValue([{ user: member }]);
    taskRepository.create.mockImplementation((value) => value);
    taskRepository.save.mockImplementation(async (value) => ({
      id: 44,
      ...value,
    }));

    await service.processImportedRow({
      organizationId: 'org-1',
      projectId: 7,
      channel: 'csv',
      sourceKey: 'import:1',
      idempotencyKey: 'row:2',
      dto: {
        source: 'manual',
        title: 'Assigned import',
        assigneeEmails: ['owner@example.com', 'member@example.com'],
      },
    });

    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ assignees: [owner, member] }),
    );
  });

  it('rejects imported assignees who are not confirmed project members', async () => {
    const owner = { id: 1, email: 'owner@example.com', is_active: true };
    const outsider = { id: 8, email: 'outside@example.com', is_active: true };
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org-1',
      user: owner,
      default_ingestion_status_id: 3,
    });
    statusRepository.findOne.mockResolvedValue({ id: 3, project: { id: 7 } });
    transactionUserRepository.find.mockResolvedValue([outsider]);
    projectPeerRepository.find.mockResolvedValue([]);

    await expect(
      service.processImportedRow({
        organizationId: 'org-1',
        projectId: 7,
        channel: 'csv',
        sourceKey: 'import:1',
        idempotencyKey: 'row:2',
        dto: {
          source: 'manual',
          title: 'Unsafe assignment',
          assigneeEmails: ['outside@example.com'],
        },
      }),
    ).rejects.toThrow('Assignees must be active project members');
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it('rejects live ingestion when the project has no default ingestion status', async () => {
    ingestApiKeyRepository.findOne.mockResolvedValue({
      id: 5,
      projectId: 7,
      organization_id: 'org_1',
      revoked_at: null,
    });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      default_ingestion_status_id: null,
      user: { id: 11 },
    });

    await expect(
      service.ingestTaskEvent(
        {
          source: 'sdk',
          title: 'Broken build',
        },
        {
          ingestKeyId: 5,
          isTestKey: false,
          projectId: 7,
          organizationId: 'org_1',
        },
      ),
    ).rejects.toThrow(
      new HttpException(
        'Set a default ingestion status before using ingestion',
        400,
      ),
    );
  });

  it('returns a validated response for test keys without creating tasks', async () => {
    ingestApiKeyRepository.findOne.mockResolvedValue({
      id: 5,
      projectId: 7,
      organization_id: 'org_1',
      revoked_at: null,
    });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      default_ingestion_status_id: 3,
      user: { id: 11 },
    });
    statusRepository.findOne.mockResolvedValue({
      id: 3,
      title: 'Inbox',
      isTerminal: false,
    });

    await expect(
      service.ingestTaskEvent(
        {
          source: 'sdk',
          title: 'Broken build',
        },
        {
          ingestKeyId: 5,
          isTestKey: true,
          projectId: 7,
          organizationId: 'org_1',
        },
      ),
    ).resolves.toEqual({
      status: 'validated',
      test: true,
      projectId: 7,
      targetStatusId: 3,
    });

    expect(taskRepository.create).not.toHaveBeenCalled();
    expect(ingestedEventRepository.save).not.toHaveBeenCalled();
    expect(projectActivityRepository.save).not.toHaveBeenCalled();
    expect(projectsGateway.emitIngestionUpdated).not.toHaveBeenCalled();
  });

  it('creates tasks with severity kept separate from priority', async () => {
    ingestApiKeyRepository.findOne.mockResolvedValue({
      id: 5,
      projectId: 7,
      organization_id: 'org_1',
      revoked_at: null,
    });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      user: { id: 11 },
      organization: null,
      default_ingestion_status_id: 3,
    });
    projectIngestionSettingsRepository.findOne.mockResolvedValue(null);
    statusRepository.findOne.mockResolvedValue({
      id: 3,
      title: 'Inbox',
      isTerminal: false,
    });
    taskRepository.create.mockImplementation((payload) => payload);
    taskRepository.save.mockImplementation(async (task) => ({
      id: 21,
      ...task,
    }));
    ingestedEventRepository.create.mockImplementation((payload) => payload);
    ingestedEventRepository.save.mockImplementation(async (event) => event);

    await expect(
      service.ingestTaskEvent(
        {
          source: 'sdk',
          title: 'Broken build',
          severity: 'critical',
          priority: 0,
          dedupeKey: 'ci:prod:build-failed',
          customFields: [{ fieldId: 'field-1', value: 'production' }],
        },
        {
          ingestKeyId: 5,
          isTestKey: false,
          projectId: 7,
          organizationId: 'org_1',
        },
      ),
    ).resolves.toEqual({
      status: 'created',
      taskId: 21,
      occurrenceCount: 1,
      eventId: 'event-1',
      idempotent: false,
    });

    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Broken build',
        priority: 0,
        severity: 'critical',
      }),
    );
    expect(ingestedEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'critical',
      }),
    );
    expect(customFieldsService.setTaskValuesInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'org_1',
      7,
      21,
      [{ fieldId: 'field-1', value: 'production' }],
      true,
    );
    expect(projectsGateway.emitIngestionUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 7,
        taskId: 21,
        action: 'created',
        occurrenceCount: 1,
      }),
    );
  });

  it('reopens terminal tasks when a duplicate event is ingested', async () => {
    ingestApiKeyRepository.findOne.mockResolvedValue({
      id: 5,
      projectId: 7,
      organization_id: 'org_1',
      revoked_at: null,
    });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      default_ingestion_status_id: 3,
      user: { id: 11 },
    });
    projectIngestionSettingsRepository.findOne.mockResolvedValue({
      closedTaskDedupeBehavior: 'reopen',
      reopenIfRecentWindowDays: 7,
    });
    statusRepository.findOne.mockResolvedValue({
      id: 3,
      title: 'Inbox',
      isTerminal: false,
    });
    ingestedEventRepository.findOne.mockResolvedValue({
      id: 9,
      taskId: 21,
      projectId: 7,
      dedupe_key: 'dup-1',
      occurrence_count: 1,
      severity: 'high',
      metadata: { a: 1 },
    });
    taskRepository.findOne.mockResolvedValue({
      id: 21,
      title: 'Broken build',
      status: { id: 8, isTerminal: true },
    });
    taskRepository.save.mockImplementation(async (task) => task);
    ingestedEventRepository.save.mockImplementation(async (event) => event);

    await expect(
      service.ingestTaskEvent(
        {
          source: 'sdk',
          title: 'Broken build',
          dedupeKey: 'dup-1',
          severity: 'critical',
        },
        {
          ingestKeyId: 5,
          isTestKey: false,
          projectId: 7,
          organizationId: 'org_1',
        },
      ),
    ).resolves.toEqual({
      status: 'deduped',
      taskId: 21,
      occurrenceCount: 2,
      eventId: 'event-1',
      idempotent: false,
    });

    expect(projectsGateway.emitIngestionUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 7,
        taskId: 21,
        action: 'reopened',
        occurrenceCount: 2,
      }),
    );

    expect(projectActivityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: ActivityType.TASK_REOPENED_BY_INGESTION,
        entityId: 21,
      }),
    );
    expect(customWorkflowsService.transitionTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 11 }),
      'org_1',
      expect.objectContaining({ id: 21 }),
      3,
    );
    expect(taskRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 21,
        severity: 'critical',
      }),
    );
    expect(ingestedEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'critical',
        occurrence_count: 2,
      }),
    );
  });

  it('creates a new task for closed duplicates when the project opts into create_new', async () => {
    ingestApiKeyRepository.findOne.mockResolvedValue({
      id: 5,
      projectId: 7,
      organization_id: 'org_1',
      revoked_at: null,
    });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      default_ingestion_status_id: 3,
      user: { id: 11 },
      organization: null,
    });
    projectIngestionSettingsRepository.findOne.mockResolvedValue({
      closedTaskDedupeBehavior: 'create_new',
      reopenIfRecentWindowDays: 7,
    });
    statusRepository.findOne.mockResolvedValue({
      id: 3,
      title: 'Inbox',
      isTerminal: false,
    });
    ingestedEventRepository.findOne.mockResolvedValue({
      id: 9,
      taskId: 21,
      projectId: 7,
      dedupe_key: 'dup-1',
      occurrence_count: 1,
      severity: 'high',
      metadata: { a: 1 },
    });
    taskRepository.findOne.mockResolvedValue({
      id: 21,
      title: 'Broken build',
      severity: 'high',
      status: { id: 8, isTerminal: true },
    });
    taskRepository.create.mockImplementation((payload) => payload);
    taskRepository.save.mockImplementation(async (task) => ({
      id: 44,
      ...task,
    }));
    ingestedEventRepository.create.mockImplementation((payload) => payload);
    ingestedEventRepository.save.mockImplementation(async (event) => event);

    await expect(
      service.ingestTaskEvent(
        {
          source: 'sdk',
          title: 'Broken build again',
          dedupeKey: 'dup-1',
          severity: 'critical',
        },
        {
          ingestKeyId: 5,
          isTestKey: false,
          projectId: 7,
          organizationId: 'org_1',
        },
      ),
    ).resolves.toEqual({
      status: 'created',
      taskId: 44,
      occurrenceCount: 1,
      eventId: 'event-1',
      idempotent: false,
    });

    expect(taskRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Broken build again',
      }),
    );
    expect(projectActivityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: ActivityType.TASK_INGESTED,
        entityId: 44,
      }),
    );
  });

  it('reopens recently closed duplicates when the project uses reopen_if_recent', async () => {
    ingestApiKeyRepository.findOne.mockResolvedValue({
      id: 5,
      projectId: 7,
      organization_id: 'org_1',
      revoked_at: null,
    });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      default_ingestion_status_id: 3,
      user: { id: 11 },
    });
    projectIngestionSettingsRepository.findOne.mockResolvedValue({
      closedTaskDedupeBehavior: 'reopen_if_recent',
      reopenIfRecentWindowDays: 7,
    });
    statusRepository.findOne.mockResolvedValue({
      id: 3,
      title: 'Inbox',
      isTerminal: false,
    });
    ingestedEventRepository.findOne.mockResolvedValue({
      id: 9,
      taskId: 21,
      projectId: 7,
      dedupe_key: 'dup-2',
      occurrence_count: 1,
      severity: 'high',
      metadata: { a: 1 },
    });
    taskRepository.findOne.mockResolvedValue({
      id: 21,
      title: 'Broken build',
      status: { id: 8, isTerminal: true },
      updated_at: new Date(),
    });
    taskRepository.save.mockImplementation(async (task) => task);
    ingestedEventRepository.save.mockImplementation(async (event) => event);

    await expect(
      service.ingestTaskEvent(
        {
          source: 'sdk',
          title: 'Broken build',
          dedupeKey: 'dup-2',
          severity: 'critical',
        },
        {
          ingestKeyId: 5,
          isTestKey: false,
          projectId: 7,
          organizationId: 'org_1',
        },
      ),
    ).resolves.toEqual({
      status: 'deduped',
      taskId: 21,
      occurrenceCount: 2,
      eventId: 'event-1',
      idempotent: false,
    });
  });

  it('captures task.ingested and notifies the owner and assignees after commit', async () => {
    const owner = { id: 11, email: 'owner@example.com' };
    const assignee = { id: 12, email: 'assignee@example.com' };
    ingestApiKeyRepository.findOne.mockResolvedValue({
      id: 5,
      projectId: 7,
      organization_id: 'org_1',
      revoked_at: null,
    });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      default_ingestion_status_id: 3,
      user: owner,
      organization: null,
    });
    statusRepository.findOne.mockResolvedValue({ id: 3, title: 'Inbox' });
    taskRepository.create.mockImplementation((payload) => payload);
    taskRepository.save.mockImplementation(async (task) => ({
      id: 44,
      ...task,
    }));
    taskRepository.findOne.mockResolvedValue({
      id: 44,
      title: 'Webhook incident',
      assignees: [assignee],
    });
    automationEventsService.taskSnapshot.mockResolvedValue({
      task: { id: 44, title: 'Webhook incident', assigneeIds: [12] },
      customFields: {},
    });
    normalizedIntakeService.receive.mockResolvedValue({
      event: {
        id: 'event-1',
        channel: 'webhook',
        received_at: new Date('2026-08-16T10:00:00Z'),
        state: 'received',
      },
      idempotent: false,
    });

    await service.ingestTaskEvent(
      {
        source: 'sentry',
        title: 'Webhook incident',
      },
      {
        ingestKeyId: 5,
        isTestKey: false,
        projectId: 7,
        organizationId: 'org_1',
      },
    );

    expect(automationEventsService.capture).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'task.ingested',
        subjectId: 44,
        dedupeKey: 'task-ingested:event-1',
        correlationId: 'event-1',
        after: expect.objectContaining({
          channel: 'webhook',
          source: 'sentry',
          outcome: 'created',
          occurrence_count: 1,
        }),
      }),
    );
    expect(notificationsService.enqueueNotification).toHaveBeenCalledTimes(2);
    expect(notificationsService.enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: owner,
        type: 'task_ingested',
        metadata: expect.objectContaining({
          intakeEventId: 'event-1',
          taskId: 44,
        }),
      }),
      'org_1',
    );
  });
});
