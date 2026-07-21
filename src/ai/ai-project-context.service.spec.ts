import { ProjectPermission } from 'src/common/authorization/authorization.service';
import { AiProjectContextService } from './ai-project-context.service';

describe('AiProjectContextService', () => {
  it('requires contribute access and assembles bounded project context', async () => {
    const projects: any = {
      findOne: jest.fn().mockResolvedValue({
        id: 5,
        title: 'Launch',
        description: 'Ship the new product',
      }),
    };
    const tasks: any = {
      find: jest.fn().mockResolvedValue([
        {
          title: 'QA release',
          status: { title: 'In progress', isTerminal: false },
          due_date: null,
          priority: 1,
        },
      ]),
    };
    const updates: any = {
      find: jest.fn().mockResolvedValue([
        {
          health: 'at_risk',
          accomplishments: 'Beta shipped',
          blockers: 'QA capacity',
          next_steps: 'Finish testing',
        },
      ]),
    };
    const authorization: any = {
      assertProjectPermission: jest.fn().mockResolvedValue({ role: 'contributor' }),
    };
    const service = new AiProjectContextService(
      projects,
      tasks,
      updates,
      authorization,
    );

    const result = await service.assembleUpdateContext(
      { userId: 8 },
      'org-1',
      5,
    );

    expect(authorization.assertProjectPermission).toHaveBeenCalledWith(
      { userId: 8 },
      'org-1',
      5,
      ProjectPermission.CONTRIBUTE,
    );
    expect(tasks.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
    expect(updates.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(result).toContain('QA release | status=In progress');
    expect(result).toContain('blockers=QA capacity');
  });
});
