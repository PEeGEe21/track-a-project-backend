import { BadRequestException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';

describe('WorkflowsService', () => {
  const authorization = { assertProjectPermission: jest.fn() };
  const service = new WorkflowsService(
    {} as any,
    authorization as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    authorization.assertProjectPermission.mockResolvedValue({ role: 'editor' });
  });

  it('rejects an empty task selection before writing', async () => {
    await expect(
      service.createTemplate({ userId: 7 }, 'org', 10, {
        name: 'Release',
        taskIds: [],
        confirmDuplicates: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects repeated task IDs in an ordered selection', async () => {
    await expect(
      service.createTemplate({ userId: 7 }, 'org', 10, {
        name: 'Release',
        taskIds: [2, 2],
        confirmDuplicates: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks Editor permission before validating a selection', async () => {
    await expect(
      service.createTemplate({ userId: 7 }, 'org', 10, {
        name: 'Release',
        taskIds: [],
        confirmDuplicates: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(authorization.assertProjectPermission).toHaveBeenCalledWith(
      { userId: 7 },
      'org',
      10,
      'edit',
    );
  });

  it('retains every stored workflow-step assignee', () => {
    expect(
      (service as any).sourceAssigneeIds({
        source_assignee_id: 2,
        source_assignee_ids: [2, 4, 4, 7],
      }),
    ).toEqual([2, 4, 7]);
  });

  it('supports workflow steps created before multi-assignee storage', () => {
    expect(
      (service as any).sourceAssigneeIds({
        source_assignee_id: 2,
        source_assignee_ids: null,
      }),
    ).toEqual([2]);
  });

  it('uses direct membership records when retaining assignees', async () => {
    const membershipService = new WorkflowsService(
      {} as any,
      authorization as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue({ user: { id: 1 } }) } as any,
      {} as any,
      {} as any,
      {} as any,
      {
        find: jest.fn().mockResolvedValue([{ user: { id: 2 } }]),
      } as any,
      {
        find: jest.fn().mockResolvedValue([{ user_id: 3 }]),
      } as any,
      {} as any,
      {} as any,
    );

    await expect(
      (membershipService as any).validateProjectAssignees(
        { userId: 99, role: 'super_admin' },
        'org',
        10,
        [1, 2, 3, 4],
        false,
      ),
    ).resolves.toEqual(new Set([1, 2, 3]));
    expect(authorization.assertProjectPermission).not.toHaveBeenCalled();
  });

  it('rejects template mappings that do not match task order', async () => {
    const tasks = {
      find: jest.fn().mockResolvedValue([
        { id: 1, title: 'One', assignees: [], project: { id: 10 } },
        { id: 2, title: 'Two', assignees: [], project: { id: 10 } },
      ]),
    };
    const mappingService = new WorkflowsService(
      {} as any,
      authorization as any,
      {} as any,
      {} as any,
      tasks as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      mappingService.createTemplate({ userId: 7 }, 'org', 10, {
        name: 'Release',
        taskIds: [1, 2],
        steps: [
          { taskId: 2, title: 'Two' },
          { taskId: 1, title: 'One' },
        ],
        confirmDuplicates: false,
      }),
    ).rejects.toThrow('Workflow step mappings must match');
  });

  it('atomically identifies conversion sources already claimed', async () => {
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce({ affectedRows: 0 }),
    };

    await expect(
      (service as any).claimConversionSources(
        manager,
        'org',
        'whiteboard_object',
        ['board:b', 'board:a'],
      ),
    ).resolves.toEqual(['board:b']);
    expect(manager.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT IGNORE'),
      ['org', 'whiteboard_object', 'board:a'],
    );
  });
});
