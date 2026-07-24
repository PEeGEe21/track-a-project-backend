import { BadRequestException } from '@nestjs/common';
import { GlobalSearchService } from './global-search.service';

describe('GlobalSearchService', () => {
  const repository = () => ({ find: jest.fn() });

  it('searches only projects owned by or shared with the member', async () => {
    const projects: any = repository();
    const peers: any = repository();
    const tasks: any = repository();
    const documents: any = repository();
    const notes: any = repository();
    const resources: any = repository();
    const documentFiles: any = repository();
    const authorization: any = {
      getProjectAccessScope: jest
        .fn()
        .mockResolvedValue({ canAccessAllProjects: false, userId: 7 }),
    };
    const messages: any = {
      search: jest.fn().mockResolvedValue({ data: { messages: [] } }),
    };

    projects.find
      .mockResolvedValueOnce([{ id: 1, title: 'Owned' }])
      .mockResolvedValueOnce([
        {
          id: 1,
          title: 'Owned',
          description: 'Launch plan',
          updated_at: new Date(),
        },
      ]);
    peers.find.mockResolvedValue([
      { project: { id: 2, title: 'Shared project' } },
    ]);
    tasks.find.mockResolvedValue([
      {
        id: 10,
        title: 'Launch task',
        description: '',
        project: { id: 2, title: 'Shared project' },
        updated_at: new Date(),
      },
    ]);
    documents.find.mockResolvedValue([]);
    notes.find.mockResolvedValue([]);
    resources.find.mockResolvedValue([]);
    documentFiles.find.mockResolvedValue([]);

    const service = new GlobalSearchService(
      projects,
      peers,
      tasks,
      documents,
      notes,
      resources,
      documentFiles,
      authorization,
      messages,
    );
    const result = await service.search(
      { userId: 7, role: 'member' } as any,
      'org-1',
      'launch',
    );

    const taskQuery = tasks.find.mock.calls[0][0];
    expect(taskQuery.where[0].project.id._value).toEqual([1, 2]);
    expect(taskQuery.where[0].organization_id).toBe('org-1');
    expect(notes.find.mock.calls[0][0].where[0].user.id).toBe(7);
    expect(messages.search).toHaveBeenCalledWith(
      { userId: 7, role: 'member' },
      'org-1',
      'launch',
    );
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'project', id: '1' }),
        expect.objectContaining({ type: 'task', id: '10' }),
      ]),
    );
  });

  it('rejects queries that are too short before loading data', async () => {
    const repos = Array.from({ length: 7 }, repository) as any[];
    const authorization: any = { getProjectAccessScope: jest.fn() };
    const messages: any = { search: jest.fn() };
    const service = new GlobalSearchService(
      repos[0],
      repos[1],
      repos[2],
      repos[3],
      repos[4],
      repos[5],
      repos[6],
      authorization,
      messages,
    );

    await expect(
      service.search({ userId: 7 } as any, 'org-1', 'a'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(authorization.getProjectAccessScope).not.toHaveBeenCalled();
  });
});
