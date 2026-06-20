import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IngestionController } from '../src/ingestion/controllers/ingestion.controller';
import { CreateIngestedTaskDto } from '../src/ingestion/dto/create-ingested-task.dto';
import { IngestionBodySizeGuard } from '../src/ingestion/guards/ingestion-body-size.guard';
import { IngestionApiKeyGuard } from '../src/ingestion/guards/ingestion-api-key.guard';
import { IngestionRateLimitGuard } from '../src/ingestion/guards/ingestion-rate-limit.guard';
import { IngestionService } from '../src/ingestion/services/ingestion.service';
import { IngestionKeyService } from '../src/ingestion/services/ingestion-key.service';
import { RedisThrottlerStorage } from '../src/common/rate-limit/redis-throttler.storage';
import { ProjectActivitiesService } from '../src/project-activities/services/project-activities.service';
import { Project } from '../src/typeorm/entities/Project';
import { Task } from '../src/typeorm/entities/Task';
import { Status } from '../src/typeorm/entities/Status';
import { User } from '../src/typeorm/entities/User';
import { IngestApiKey } from '../src/typeorm/entities/IngestApiKey';
import { IngestedEvent } from '../src/typeorm/entities/IngestedEvent';

describe('Ingestion request lifecycle (integration)', () => {
  let controller: IngestionController;
  let apiKeyGuard: IngestionApiKeyGuard;
  let rateLimitGuard: IngestionRateLimitGuard;
  let bodySizeGuard: IngestionBodySizeGuard;

  const validationPipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  });

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

  const userRepository = {};

  const ingestApiKeyRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const ingestedEventRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const ingestionKeyService = {
    hashKey: jest.fn(),
    isTestKey: jest.fn(),
    touchLastUsed: jest.fn(),
  };

  const redisThrottlerStorage = {
    increment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        IngestionService,
        IngestionApiKeyGuard,
        IngestionRateLimitGuard,
        IngestionBodySizeGuard,
        {
          provide: ProjectActivitiesService,
          useValue: projectActivitiesService,
        },
        {
          provide: IngestionKeyService,
          useValue: ingestionKeyService,
        },
        {
          provide: RedisThrottlerStorage,
          useValue: redisThrottlerStorage,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: taskRepository,
        },
        {
          provide: getRepositoryToken(Status),
          useValue: statusRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(IngestApiKey),
          useValue: ingestApiKeyRepository,
        },
        {
          provide: getRepositoryToken(IngestedEvent),
          useValue: ingestedEventRepository,
        },
      ],
    }).compile();

    controller = moduleFixture.get(IngestionController);
    apiKeyGuard = moduleFixture.get(IngestionApiKeyGuard);
    rateLimitGuard = moduleFixture.get(IngestionRateLimitGuard);
    bodySizeGuard = moduleFixture.get(IngestionBodySizeGuard);

    ingestionKeyService.hashKey.mockReturnValue('hashed-key');
    redisThrottlerStorage.increment.mockResolvedValue({
      totalHits: 1,
      timeToExpire: 60000,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    ingestApiKeyRepository.findOne.mockResolvedValue({
      id: 5,
      projectId: 7,
      organization_id: 'org_1',
      revoked_at: null,
    });
    ingestApiKeyRepository.update.mockResolvedValue({ affected: 1 });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      organization: { id: 'org_1' },
      default_ingestion_status_id: 3,
      user: { id: 11 },
    });
    statusRepository.findOne.mockResolvedValue({
      id: 3,
      title: 'Inbox',
      color: '#111111',
      isTerminal: false,
    });
  });

  const createContext = (request: any, response: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    }) as ExecutionContext;

  const executeRequest = async (
    authorization: string,
    payload: Record<string, unknown>,
  ) => {
    const request = {
      headers: {
        authorization,
        'content-length': String(Buffer.byteLength(JSON.stringify(payload))),
      },
      body: await validationPipe.transform(payload, {
        type: 'body',
        metatype: CreateIngestedTaskDto,
      }),
    };
    const response = {
      status: jest.fn(),
    };
    const context = createContext(request, response);

    await apiKeyGuard.canActivate(context);
    await rateLimitGuard.canActivate(context);
    expect(bodySizeGuard.canActivate(context)).toBe(true);

    const result = await controller.ingestTask(
      request.body,
      request,
      response as any,
    );

    return { request, response, result };
  };

  it('creates a task for a live key', async () => {
    ingestionKeyService.isTestKey.mockReturnValue(false);
    ingestedEventRepository.findOne.mockResolvedValue(null);
    taskRepository.create.mockImplementation((value) => value);
    taskRepository.save.mockImplementation(async (value) => ({
      id: 21,
      ...value,
    }));
    ingestedEventRepository.create.mockImplementation((value) => value);
    ingestedEventRepository.save.mockImplementation(async (value) => value);

    const { result, response } = await executeRequest('Bearer trk_live_secret', {
      source: 'sdk',
      title: 'Build failed in production',
      severity: 'high',
      dedupeKey: 'ci:prod:build-failed',
    });

    expect(response.status).toHaveBeenCalledWith(201);
    expect(result).toEqual({
      status: 'created',
      taskId: 21,
      occurrenceCount: 1,
    });
  });

  it('dedupes and reopens a terminal task for duplicate live events', async () => {
    ingestionKeyService.isTestKey.mockReturnValue(false);
    ingestedEventRepository.findOne.mockResolvedValue({
      id: 9,
      taskId: 21,
      projectId: 7,
      dedupe_key: 'ci:prod:build-failed',
      occurrence_count: 1,
      severity: 'high',
      metadata: null,
    });
    taskRepository.findOne.mockResolvedValue({
      id: 21,
      title: 'Build failed in production',
      status: { id: 8, isTerminal: true },
    });
    taskRepository.save.mockImplementation(async (value) => value);
    ingestedEventRepository.save.mockImplementation(async (value) => value);

    const { result, response } = await executeRequest('Bearer trk_live_secret', {
      source: 'sdk',
      title: 'Build failed in production',
      severity: 'critical',
      dedupeKey: 'ci:prod:build-failed',
    });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(result).toEqual({
      status: 'deduped',
      taskId: 21,
      occurrenceCount: 2,
    });
  });

  it('validates without writing for a test key', async () => {
    ingestionKeyService.isTestKey.mockReturnValue(true);

    const { result, response } = await executeRequest('Bearer trk_test_secret', {
      source: 'sdk',
      title: 'Build failed in staging',
    });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(result).toEqual({
      status: 'validated',
      test: true,
      projectId: 7,
      targetStatusId: 3,
    });
    expect(taskRepository.create).not.toHaveBeenCalled();
    expect(ingestedEventRepository.save).not.toHaveBeenCalled();
  });
});
