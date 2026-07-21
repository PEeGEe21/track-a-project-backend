import { ProjectPermission } from 'src/common/authorization/authorization.service';
import { AiTaskContextService } from './ai-task-context.service';

describe('AiTaskContextService', () => {
  it('authorizes access and assembles only server-loaded, non-deleted comments', async () => {
    const tasks: any = {
      findOne: jest.fn().mockResolvedValue({
        id: 9,
        title: 'Ship release',
        project: { id: 4 },
      }),
    };
    const comments: any = {
      find: jest.fn().mockResolvedValue([
        {
          content: 'The rollout is approved.',
          author: { fullName: 'Ada' },
        },
        {
          content: 'QA is still blocking release.',
          author: { fullName: 'Lin' },
        },
      ]),
    };
    const authorization: any = {
      assertProjectPermission: jest.fn().mockResolvedValue({ role: 'viewer' }),
    };
    const service = new AiTaskContextService(
      tasks,
      comments,
      authorization,
    );

    const result = await service.assembleDiscussion(
      { userId: 7 },
      'org-1',
      9,
    );

    expect(authorization.assertProjectPermission).toHaveBeenCalledWith(
      { userId: 7 },
      'org-1',
      4,
      ProjectPermission.VIEW,
    );
    expect(comments.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
    expect(result).toContain('Task: Ship release');
    expect(result).toContain('Lin: QA is still blocking release.');
    expect(result).toContain('Ada: The rollout is approved.');
  });
});
