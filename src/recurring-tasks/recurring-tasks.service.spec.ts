import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  RecurrenceFrequency,
  RecurrenceGenerationMode,
} from 'src/typeorm/entities/TaskRecurrence';
import { RecurringTasksService } from './recurring-tasks.service';

describe('RecurringTasksService', () => {
  const recurrences = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const occurrences = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const tasks = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const statuses = { findOne: jest.fn() };
  const authorization = {
    assertProjectAccess: jest.fn(),
    assertProjectPermission: jest.fn(),
  };
  const entitlements = { assertCapability: jest.fn() };
  let service: RecurringTasksService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new RecurringTasksService(
      recurrences as any,
      occurrences as any,
      tasks as any,
      statuses as any,
      authorization as any,
      entitlements as any,
    );
  });

  it('rejects an invalid IANA timezone', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      project: { id: 5 },
      role: 'contributor',
    });
    await expect(
      service.create(
        5,
        {
          template_task_id: 10,
          frequency: RecurrenceFrequency.DAILY,
          interval: 1,
          timezone: 'Not/AZone',
          generation_mode: RecurrenceGenerationMode.BEFORE_DUE,
          generate_before_days: 0,
          next_due_at: new Date('2026-07-20T09:00:00Z'),
        },
        { userId: 2 } as any,
        'org-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires selected days for a weekday recurrence', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      project: { id: 5 },
      role: 'contributor',
    });
    await expect(
      service.create(
        5,
        {
          template_task_id: 10,
          frequency: RecurrenceFrequency.WEEKDAYS,
          interval: 1,
          timezone: 'Africa/Lagos',
          generation_mode: RecurrenceGenerationMode.BEFORE_DUE,
          generate_before_days: 0,
          next_due_at: new Date('2026-07-20T09:00:00Z'),
        },
        { userId: 2 } as any,
        'org-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose a template task from another project', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      project: { id: 5 },
      role: 'contributor',
    });
    tasks.findOne.mockResolvedValue({ id: 10, project: { id: 6 } });
    await expect(
      service.create(
        5,
        {
          template_task_id: 10,
          frequency: RecurrenceFrequency.DAILY,
          interval: 1,
          timezone: 'Africa/Lagos',
          generation_mode: RecurrenceGenerationMode.ON_COMPLETION,
          generate_before_days: 0,
          next_due_at: new Date('2026-07-20T09:00:00Z'),
        },
        { userId: 2 } as any,
        'org-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses the template task completion to generate the first occurrence', async () => {
    occurrences.findOne.mockResolvedValue(null);
    const rule = {
      id: 3,
      active: true,
      template_task_id: 10,
      generation_mode: RecurrenceGenerationMode.ON_COMPLETION,
    };
    recurrences.findOne.mockResolvedValue(rule);
    jest.spyOn(service, 'generate').mockResolvedValue({ id: 11 } as any);
    await service.generateAfterCompletion(10);
    expect(service.generate).toHaveBeenCalledWith(rule);
  });

  it('returns an existing occurrence instead of generating a duplicate', async () => {
    occurrences.findOne.mockResolvedValue({ task: { id: 20 } });
    await expect(
      service.generate({ id: 3, next_due_at: new Date('2026-07-20') } as any),
    ).resolves.toEqual({ id: 20 });
    expect(tasks.save).not.toHaveBeenCalled();
  });

  it('preserves local wall-clock time across daylight-saving changes', () => {
    const next = (service as any).nextDue(
      {
        frequency: RecurrenceFrequency.DAILY,
        interval: 1,
        timezone: 'America/New_York',
      },
      new Date('2026-03-07T14:00:00Z'),
    );
    expect(next.toISOString()).toBe('2026-03-08T13:00:00.000Z');
  });

  it('creates a recurrence with the task inside the caller transaction', async () => {
    const repository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 8, ...value })),
    };
    const manager = { getRepository: jest.fn().mockReturnValue(repository) };
    const task = { id: 10, project: { id: 5 } };
    await service.createForTaskInTransaction(
      manager as any,
      task as any,
      {
        frequency: RecurrenceFrequency.WEEKLY,
        interval: 1,
        timezone: 'Africa/Lagos',
        generation_mode: RecurrenceGenerationMode.ON_COMPLETION,
        generate_before_days: 0,
        next_due_at: new Date('2026-07-20T09:00:00Z'),
      },
      { userId: 2 } as any,
      'org-1',
    );
    expect(entitlements.assertCapability).toHaveBeenCalledWith(
      { userId: 2 },
      'org-1',
      'recurring_tasks',
    );
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ template_task_id: 10, project_id: 5 }),
    );
  });
});
