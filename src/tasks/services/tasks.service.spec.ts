import { TasksService } from './tasks.service';
import { NOTIFICATION_TYPES } from 'src/utils/constants/notifications';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';

describe('TasksService', () => {
  let service: TasksService;
  const taskRepository = { findOne: jest.fn(), find: jest.fn() };
  const authorizationService = { assertProjectAccess: jest.fn() };

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
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('checks tenant and project authorization before a task mutation', async () => {
    taskRepository.findOne.mockResolvedValue({
      id: 55,
      project: { id: 7 },
    });
    authorizationService.assertProjectAccess.mockResolvedValue({ id: 7 });

    await (service as any).assertTaskWriteAccess(55, { userId: 2 }, 'org-1');

    expect(taskRepository.findOne).toHaveBeenCalledWith({
      where: { id: 55, organization_id: 'org-1' },
      relations: ['project'],
    });
    expect(authorizationService.assertProjectAccess).toHaveBeenCalledWith({
      actor: { userId: 2 },
      organizationId: 'org-1',
      projectId: 7,
      action: 'write',
    });
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

  it('builds task status notification recipients without duplicates', () => {
    const recipients = (service as any).getTaskStatusNotificationRecipients(
      {
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
      },
    );

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
