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

  let service: IngestionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IngestionService(
      projectActivitiesService as any,
      projectRepository as any,
      taskRepository as any,
      statusRepository as any,
      userRepository as any,
      ingestApiKeyRepository as any,
      ingestedEventRepository as any,
    );
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
    ).rejects.toThrow(new HttpException(
      'Set a default ingestion status before using ingestion',
      400,
    ));
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
    expect(projectActivitiesService.createActivity).not.toHaveBeenCalled();
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
    });

    expect(projectActivitiesService.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: ActivityType.TASK_REOPENED_BY_INGESTION,
        entityId: 21,
      }),
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
});
