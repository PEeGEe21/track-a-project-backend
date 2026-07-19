import { TaskDiscussionsService } from './task-discussions.service';
describe('TaskDiscussionsService', () => {
  const repo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    remove: jest.fn(),
  });
  it('paginates root threads separately from replies', async () => {
    const comments: any = repo(),
      reactions: any = repo(),
      edits: any = repo(),
      tasks: any = repo(),
      users: any = repo(),
      peers: any = repo(),
      projects: any = repo(),
      notifications: any = repo(),
      auth: any = {
        assertProjectPermission: jest
          .fn()
          .mockResolvedValue({ isCreator: false }),
      };
    tasks.findOne.mockResolvedValue({ id: 4, project: { id: 2 } });
    users.findOne.mockResolvedValue({ id: 8 });
    comments.findAndCount.mockResolvedValue([[{ id: 'root' }], 12]);
    comments.find.mockResolvedValue([{ id: 'reply', root_id: 'root' }]);
    const s = new TaskDiscussionsService(
      comments,
      reactions,
      edits,
      tasks,
      users,
      peers,
      projects,
      notifications,
      auth,
    );
    const x = await s.list({ userId: 8 }, 'org', 4, 2, 10);
    expect(comments.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(x.data).toHaveLength(2);
    expect(x.meta).toMatchObject({ current_page: 2, last_page: 2, total: 12 });
  });
});
