import { Milestone, MilestoneStatus } from 'src/typeorm/entities/Milestone';
import { MilestoneTask } from 'src/typeorm/entities/MilestoneTask';
import { ProjectPeer } from 'src/typeorm/entities/ProjectPeer';
import { Task } from 'src/typeorm/entities/Task';
import { MilestonesService } from './milestones.service';

describe('MilestonesService', () => {
  const milestones = {
    manager: { getRepository: jest.fn() },
    findAndCount: jest.fn(),
    save: jest.fn(),
  };
  const projectPeers = { exists: jest.fn() };
  const authorization = { assertProjectPermission: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const activities = { createActivity: jest.fn().mockResolvedValue({}) };
  let service: MilestonesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MilestonesService(
      milestones as any,
      projectPeers as any,
      authorization as any,
      dataSource as any,
      activities as any,
    );
  });

  it('scopes milestone lists to the organization and project', async () => {
    authorization.assertProjectPermission.mockResolvedValue({});
    milestones.findAndCount.mockResolvedValue([[], 0]);

    await service.list(
      { userId: 3 } as any,
      'org-1',
      7,
      {} as any,
    );

    expect(milestones.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          project_id: 7,
        }),
      }),
    );
  });

  it('rejects an owner who is not an active project member', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      project: { user: { id: 1 } },
    });
    projectPeers.exists.mockResolvedValue(false);

    await expect(
      service.create({ userId: 3 } as any, 'org-1', 7, {
        title: 'Launch',
        ownerId: 99,
      }),
    ).rejects.toThrow('Milestone owner must be an active project member');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate task links before replacing stored links', async () => {
    const taskLinks = { delete: jest.fn(), save: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === MilestoneTask) return taskLinks;
        if (entity === Task) return { find: jest.fn() };
        throw new Error(`Unexpected entity ${entity?.name}`);
      }),
    };

    await expect(
      (service as any).replaceTaskLinks(manager, 'milestone-1', 7, [
        { taskId: 10 },
        { taskId: 10 },
      ]),
    ).rejects.toThrow('Milestone task links must be unique');
    expect(taskLinks.delete).not.toHaveBeenCalled();
  });

  it('rejects task links outside the milestone project atomically', async () => {
    const taskLinks = { delete: jest.fn(), save: jest.fn() };
    const tasks = { find: jest.fn().mockResolvedValue([{ id: 10 }]) };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === MilestoneTask) return taskLinks;
        if (entity === Task) return tasks;
        throw new Error(`Unexpected entity ${entity?.name}`);
      }),
    };

    await expect(
      (service as any).replaceTaskLinks(manager, 'milestone-1', 7, [
        { taskId: 10 },
        { taskId: 99 },
      ]),
    ).rejects.toThrow('A linked task does not belong to this project');
    expect(taskLinks.delete).not.toHaveBeenCalled();
  });

  it('permits the project creator as milestone owner without a peer row', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      project: { user: { id: 5 } },
    });
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'milestone-1', ...value })),
      findOne: jest.fn().mockResolvedValue({
        id: 'milestone-1',
        title: 'Launch',
        task_links: [],
      }),
    };
    const taskLinks = { delete: jest.fn(), save: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Milestone) return repo;
        if (entity === MilestoneTask) return taskLinks;
        throw new Error(`Unexpected entity ${entity?.name}`);
      }),
    };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );

    await expect(
      service.create({ userId: 5 } as any, 'org-1', 7, {
        title: ' Launch ',
        ownerId: 5,
      }),
    ).resolves.toMatchObject({ success: true });
    expect(projectPeers.exists).not.toHaveBeenCalled();
  });

  it('calculates progress only from eligible task terminal states', () => {
    const progress = (service as any).calculateProgress({
      task_links: [
        {
          counts_toward_progress: true,
          task: { status: { isTerminal: true } },
        },
        {
          counts_toward_progress: true,
          task: { status: { isTerminal: false } },
        },
        {
          counts_toward_progress: false,
          task: { status: { isTerminal: false } },
        },
      ],
    });

    expect(progress).toEqual({
      percent: 50,
      eligibleTasks: 2,
      completedTasks: 1,
      openTasks: 1,
    });
  });

  it('requires a reason when completing with eligible tasks still open', async () => {
    authorization.assertProjectPermission.mockResolvedValue({});
    const repo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'milestone-1',
        archived_at: null,
        task_links: [
          {
            counts_toward_progress: true,
            task: { status: { isTerminal: false } },
          },
        ],
      }),
      save: jest.fn(),
    };
    const manager = { getRepository: jest.fn(() => repo) };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );

    await expect(
      service.transition(
        { userId: 5 } as any,
        'org-1',
        7,
        'milestone-1',
        { status: MilestoneStatus.COMPLETED },
      ),
    ).rejects.toThrow(
      'A completion reason is required while milestone tasks remain open',
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('completes without a reason when every eligible task is terminal', async () => {
    authorization.assertProjectPermission.mockResolvedValue({});
    const item: any = {
      id: 'milestone-1',
      title: 'Launch',
      archived_at: null,
      status: MilestoneStatus.IN_PROGRESS,
      task_links: [
        {
          counts_toward_progress: true,
          task: { status: { isTerminal: true } },
        },
      ],
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(item),
      save: jest.fn(async (value) => value),
    };
    const manager = { getRepository: jest.fn(() => repo) };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );

    await service.transition(
      { userId: 5 } as any,
      'org-1',
      7,
      'milestone-1',
      { status: MilestoneStatus.COMPLETED },
    );

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MilestoneStatus.COMPLETED,
        achieved_at: expect.any(Date),
      }),
    );
    expect(activities.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'milestone',
        metadata: expect.objectContaining({
          action: 'status_changed',
          milestoneId: 'milestone-1',
        }),
      }),
    );
  });

  it('calculates a large milestone without changing progress semantics', () => {
    const task_links = Array.from({ length: 500 }, (_, index) => ({
      counts_toward_progress: index < 400,
      task: { status: { isTerminal: index < 300 } },
    }));
    expect((service as any).calculateProgress({ task_links })).toEqual({
      percent: 75,
      eligibleTasks: 400,
      completedTasks: 300,
      openTasks: 100,
    });
  });
});
