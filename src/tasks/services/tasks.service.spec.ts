import { TasksService } from './tasks.service';
import { NOTIFICATION_TYPES } from 'src/utils/constants/notifications';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';

describe('TasksService', () => {
  let service: TasksService;
  const taskRepository = { findOne: jest.fn(), find: jest.fn() };
  const authorizationService = {
    assertProjectAccess: jest.fn(),
    assertProjectPermission: jest.fn(),
    getProjectAccessScope: jest.fn(),
  };
  const savedTaskViewRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const recurringTasksService = { generateAfterCompletion: jest.fn() };

  const queryBuilder = () => {
    const query = {
      andWhere: jest.fn(),
      setParameter: jest.fn(),
    };
    query.andWhere.mockReturnValue(query);
    query.setParameter.mockReturnValue(query);
    return query;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new TasksService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      taskRepository as any,
      {} as any,
      {} as any,
      {} as any,
      authorizationService as any,
      savedTaskViewRepository as any,
      recurringTasksService as any,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('checks tenant and project authorization before a task mutation', async () => {
    taskRepository.findOne.mockResolvedValue({
      id: 55,
      project: { id: 7 },
      user: { id: 2 },
      assignees: [],
    });
    authorizationService.assertProjectPermission.mockResolvedValue({
      project: { id: 7 },
      role: 'contributor',
    });

    await (service as any).assertTaskWriteAccess(55, { userId: 2 }, 'org-1');

    expect(taskRepository.findOne).toHaveBeenCalledWith({
      where: { id: 55, organization_id: 'org-1' },
      relations: ['project', 'user', 'assignees'],
    });
    expect(authorizationService.assertProjectPermission).toHaveBeenCalledWith(
      { userId: 2 },
      'org-1',
      7,
      'contribute',
    );
  });

  it('scopes a project task list to an authorized organization project', async () => {
    const project = { id: 7 };
    authorizationService.assertProjectAccess.mockResolvedValue(project);
    taskRepository.find.mockResolvedValue([{ id: 55 }]);

    await expect(
      service.getProjectTasks(7, { userId: 2 } as any, 'org-1'),
    ).resolves.toEqual({ success: 'success', data: [{ id: 55 }] });

    expect(authorizationService.assertProjectAccess).toHaveBeenCalledWith({
      actor: { userId: 2 },
      organizationId: 'org-1',
      projectId: 7,
      action: 'read',
    });
    expect(taskRepository.find).toHaveBeenCalledWith({
      where: { project, organization_id: 'org-1' },
      relations: ['tags', 'project', 'status', 'assignees'],
    });
  });

  it('defines overdue as before the selected day and not terminal', () => {
    const query = queryBuilder();

    (service as any).applyProductivityView(query, 'overdue', 2, '2026-07-12');

    expect(query.andWhere).toHaveBeenNthCalledWith(
      1,
      'task.due_date < :dayStart',
      { dayStart: '2026-07-12' },
    );
    expect(query.andWhere).toHaveBeenNthCalledWith(
      2,
      '(status.id IS NULL OR status.isTerminal = :notTerminal)',
      { notTerminal: false },
    );
  });

  it('applies assignee and inclusive due-date filters independently of a view', () => {
    const query = queryBuilder();

    (service as any).applyProductivityFilters(query, {
      assignee_id: 9,
      due_from: '2026-07-01',
      due_to: '2026-07-12',
    });

    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('filtered_assignee.user_id = :assigneeId'),
      { assigneeId: 9 },
    );
    expect(query.andWhere).toHaveBeenCalledWith('task.due_date >= :dueFrom', {
      dueFrom: '2026-07-01 00:00:00',
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      'task.due_date < DATE_ADD(:dueTo, INTERVAL 1 DAY)',
      { dueTo: '2026-07-12' },
    );
  });

  it('lists only owned and organization-visible saved views in the selected organization', async () => {
    authorizationService.getProjectAccessScope.mockResolvedValue({
      userId: 2,
      canAccessAllProjects: false,
    });
    savedTaskViewRepository.find.mockResolvedValue([{ id: 1 }]);

    await service.getSavedTaskViews({ userId: 2 } as any, 'org-1');

    expect(savedTaskViewRepository.find).toHaveBeenCalledWith({
      where: [
        { organization_id: 'org-1', owner_id: 2 },
        { organization_id: 'org-1', visibility: 'organization' },
      ],
      order: { is_default: 'DESC', name: 'ASC', id: 'ASC' },
    });
  });

  it('does not reveal a saved view owned by another user', async () => {
    authorizationService.getProjectAccessScope.mockResolvedValue({
      userId: 2,
      canAccessAllProjects: false,
    });
    savedTaskViewRepository.findOne.mockResolvedValue(null);

    await expect(
      (service as any).getOwnedSavedTaskView(4, { userId: 2 }, 'org-1'),
    ).rejects.toThrow('Saved view not found');
    expect(savedTaskViewRepository.findOne).toHaveBeenCalledWith({
      where: { id: 4, organization_id: 'org-1', owner_id: 2 },
    });
  });

  it('builds task status notification recipients without duplicates', () => {
    const recipients = (service as any).getTaskStatusNotificationRecipients({
      user: { id: 2 },
      project: {
        user: { id: 3 },
        projectPeers: [
          {
            user: { id: 5 },
            status: ProjectPeerStatus.CONNECTED,
            is_confirmed: true,
          },
          {
            user: { id: 6 },
            status: 'pending',
            is_confirmed: true,
          },
          {
            user: { id: 7 },
            status: ProjectPeerStatus.CONNECTED,
            is_confirmed: false,
          },
        ],
      },
      assignees: [{ id: 2 }, { id: 4 }, { id: 1 }],
    });

    expect(recipients.map((user) => user.id)).toEqual([2, 3, 5, 4, 1]);
  });

  it('builds a completed notification payload with the task status change type', () => {
    const payload = (service as any).buildTaskStatusNotificationPayload(
      { fullName: 'Jane Doe' },
      {
        id: 55,
        title: 'Ship onboarding',
        status: { id: 9, title: 'Done' },
        project: { id: 7, title: 'Growth' },
      },
      'completed',
    );

    expect(payload).toMatchObject({
      title: 'Task completed',
      type: NOTIFICATION_TYPES.TASK_STATUS_CHANGE,
      metadata: {
        taskId: 55,
        projectId: 7,
        statusId: 9,
        transition: 'completed',
      },
    });
    expect(payload.message).toContain(
      'Jane Doe marked "Ship onboarding" as completed',
    );
  });
});
