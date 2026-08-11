import { AiIntakeMatchingContextService } from './ai-intake-matching-context.service';

describe('AiIntakeMatchingContextService', () => {
  const authorization = { getProjectAccessScope: jest.fn() };
  const projects = { find: jest.fn(), findOne: jest.fn() };
  const peers = { find: jest.fn() };
  const tasks = { find: jest.fn() };
  let service: AiIntakeMatchingContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiIntakeMatchingContextService(
      authorization as any,
      projects as any,
      peers as any,
      tasks as any,
    );
    authorization.getProjectAccessScope.mockResolvedValue({
      canAccessAllProjects: false,
      userId: 7,
    });
    peers.find
      .mockResolvedValueOnce([{ project: { id: 8 } }])
      .mockResolvedValueOnce([
        {
          project: { id: 8 },
          user: {
            id: 9,
            first_name: 'Grace',
            last_name: 'Hopper',
            email: 'private@example.com',
          },
        },
      ]);
    projects.find.mockResolvedValue([
      {
        id: 4,
        title: 'Operations',
        user: { id: 7, first_name: 'Ada', last_name: 'Lovelace' },
        categories: [{ name: 'Incident', organization_id: 'org-1' }],
      },
      {
        id: 8,
        title: 'Checkout',
        user: { id: 10, username: 'owner' },
        categories: [],
      },
    ]);
    tasks.find.mockResolvedValue([
      { id: 20, title: 'Checkout production alert', project: { id: 4 } },
      { id: 21, title: 'Investigate checkout alert', project: { id: 8 } },
      { id: 22, title: 'Prepare quarterly roadmap', project: { id: 4 } },
    ]);
  });

  it('returns bounded accessible projects, members, and likely duplicates without email', async () => {
    const result = await service.assemble(
      { userId: 7 } as any,
      'org-1',
      4,
      'Checkout production alert',
      20,
    );

    expect(result.projects).toEqual([
      {
        id: 4,
        title: 'Operations',
        members: [{ id: 7, name: 'Ada Lovelace' }],
      },
      {
        id: 8,
        title: 'Checkout',
        members: [
          { id: 10, name: 'owner' },
          { id: 9, name: 'Grace Hopper' },
        ],
      },
    ]);
    expect(result.duplicateTasks).toEqual([
      { id: 21, projectId: 8, title: 'Investigate checkout alert' },
    ]);
    expect(result.categories).toEqual(['Incident']);
    expect(JSON.stringify(result)).not.toContain('private@example.com');
    expect(peers.find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ organization_id: 'org-1' }),
        take: 12,
      }),
    );
    expect(tasks.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
