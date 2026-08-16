import { NormalizedIntakeService } from './normalized-intake.service';
import { BadRequestException } from '@nestjs/common';

describe('NormalizedIntakeService', () => {
  const listQuery: any = {
    leftJoinAndSelect: jest.fn(() => listQuery),
    where: jest.fn(() => listQuery),
    andWhere: jest.fn(() => listQuery),
    orderBy: jest.fn(() => listQuery),
    addOrderBy: jest.fn(() => listQuery),
    take: jest.fn(() => listQuery),
    getMany: jest.fn(),
  };
  const intakeEventRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'event-1', ...value })),
    createQueryBuilder: jest.fn(() => listQuery),
  };
  const eventRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
  };
  const attemptRepository = {
    count: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const manager = {
    getRepository: jest.fn((entity) =>
      entity?.name === 'IntakeEvent' ? eventRepository : attemptRepository,
    ),
  };
  const dataSource = {
    transaction: jest.fn(async (callback) => callback(manager)),
  };

  let service: NormalizedIntakeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NormalizedIntakeService(
      dataSource as any,
      intakeEventRepository as any,
    );
  });

  it('returns the existing scoped event for an idempotent delivery', async () => {
    const existing = {
      id: 'event-existing',
      organization_id: 'org-1',
      project_id: 7,
      channel: 'webhook',
      source_key: 'source-1',
      idempotency_key: 'delivery-1',
      state: 'accepted',
      task_id: 21,
    };
    intakeEventRepository.findOne.mockResolvedValue(existing);

    await expect(
      service.receive({
        organizationId: 'org-1',
        projectId: 7,
        channel: 'webhook',
        sourceKey: 'source-1',
        idempotencyKey: 'delivery-1',
        normalizedPayload: { title: 'Build failed' },
      }),
    ).resolves.toEqual({ event: existing, idempotent: true });
    expect(intakeEventRepository.save).not.toHaveBeenCalled();
  });

  it('recovers a concurrent scoped idempotency collision without a duplicate event', async () => {
    const concurrent = {
      id: 'event-concurrent',
      organization_id: 'org-1',
      project_id: 7,
      channel: 'webhook',
      source_key: 'source-1',
      idempotency_key: 'delivery-1',
      state: 'received',
    };
    intakeEventRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrent);
    intakeEventRepository.save.mockRejectedValueOnce({
      code: 'ER_DUP_ENTRY',
    });

    await expect(
      service.receive({
        organizationId: 'org-1',
        projectId: 7,
        channel: 'webhook',
        sourceKey: 'source-1',
        idempotencyKey: 'delivery-1',
        normalizedPayload: { title: 'Build failed' },
      }),
    ).resolves.toEqual({ event: concurrent, idempotent: true });
    expect(intakeEventRepository.findOne).toHaveBeenLastCalledWith({
      where: {
        organization_id: 'org-1',
        channel: 'webhook',
        source_key: 'source-1',
        idempotency_key: 'delivery-1',
      },
    });
  });

  it('keeps event history tenant/project scoped and bounded', async () => {
    listQuery.getMany.mockResolvedValue([]);
    await service.listScoped('org-1', 7, 100, 'failed', 'email');
    expect(listQuery.where).toHaveBeenCalledWith(
      'event.organization_id = :organizationId',
      { organizationId: 'org-1' },
    );
    expect(listQuery.andWhere).toHaveBeenCalledWith(
      'event.project_id = :projectId',
      { projectId: 7 },
    );
    expect(listQuery.andWhere).toHaveBeenCalledWith('event.state = :state', {
      state: 'failed',
    });
    expect(listQuery.take).toHaveBeenCalledWith(101);
    await expect(
      service.listScoped('org-1', 7, 25, 'not-a-state' as any),
    ).rejects.toThrow('Invalid intake event state');
  });

  it('creates an accepted event and immutable successful attempt transactionally', async () => {
    const event = {
      id: 'event-1',
      state: 'received',
      task_id: null,
      validation_snapshot: null,
      failure_code: null,
      failure_message: null,
      retryable: false,
      processed_at: null,
    };
    eventRepository.findOne.mockResolvedValue(event);
    attemptRepository.count.mockResolvedValue(0);

    const result = await service.process(event as any, async () => ({
      status: 'created',
      taskId: 21,
      occurrenceCount: 1,
    }));

    expect(result.idempotent).toBe(false);
    expect(result.event).toEqual(
      expect.objectContaining({ state: 'accepted', task_id: 21 }),
    );
    expect(eventRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: 'accepted',
        validation_snapshot: {
          valid: true,
          outcome: {
            status: 'created',
            taskId: 21,
            occurrenceCount: 1,
          },
        },
      }),
    );
    expect(attemptRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attempt_number: 1,
        trigger: 'initial',
        state: 'succeeded',
      }),
    );
  });

  it('does not invoke task creation again for an accepted event', async () => {
    const processor = jest.fn();
    const event = {
      id: 'event-1',
      state: 'accepted',
      task_id: 21,
      validation_snapshot: {
        outcome: { status: 'created', taskId: 21, occurrenceCount: 1 },
      },
    };

    await expect(service.process(event as any, processor)).resolves.toEqual({
      event,
      outcome: { status: 'created', taskId: 21, occurrenceCount: 1 },
      idempotent: true,
    });
    expect(processor).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('records an operator retry with the manual retry trigger', async () => {
    const event = {
      id: 'event-1',
      state: 'failed',
      task_id: null,
      validation_snapshot: null,
      failure_code: 'processing_failed',
      failure_message: 'Temporary failure',
      retryable: true,
      processed_at: new Date(),
    };
    eventRepository.findOne.mockResolvedValue(event);
    attemptRepository.count.mockResolvedValue(1);

    await service.process(
      event as any,
      async () => ({ status: 'created', taskId: 22 }),
      'manual_retry',
    );

    expect(attemptRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attempt_number: 2,
        trigger: 'manual_retry',
        state: 'succeeded',
      }),
    );
  });

  it('durably rejects typed/workflow validation failures without marking them retryable', async () => {
    const event = {
      id: 'event-1',
      state: 'received',
      task_id: null,
      validation_snapshot: null,
      failure_code: null,
      failure_message: null,
      retryable: false,
      processed_at: null,
    };
    eventRepository.findOne.mockResolvedValue(event);
    attemptRepository.count.mockResolvedValue(0);

    await expect(
      service.process(event as any, async () => {
        throw new BadRequestException('Invalid Custom Field value');
      }),
    ).rejects.toThrow('Invalid Custom Field value');
    expect(eventRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: 'rejected',
        failure_code: 'validation_failed',
        retryable: false,
      }),
    );
  });
});
