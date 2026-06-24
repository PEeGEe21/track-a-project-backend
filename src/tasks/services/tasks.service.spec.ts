import { TasksService } from './tasks.service';
import { NOTIFICATION_TYPES } from 'src/utils/constants/notifications';
import { ProjectPeerStatus } from 'src/utils/constants/projectPeerEnums';

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(() => {
    service = new TasksService(
      {} as any,
      {} as any,
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('builds task status notification recipients without duplicates or actor', () => {
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
      1,
    );

    expect(recipients.map((user) => user.id)).toEqual([2, 3, 5, 4]);
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
