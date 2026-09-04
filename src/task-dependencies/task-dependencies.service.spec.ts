import { TaskDependenciesService } from './task-dependencies.service';

describe('TaskDependenciesService graph validation', () => {
  const service = new TaskDependenciesService(
    { findBy: jest.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  it('rejects a transitive cycle', async () => {
    (service as any).dependencies.findBy.mockResolvedValue([
      { task_id: 2, depends_on_task_id: 3 },
      { task_id: 3, depends_on_task_id: 1 },
    ]);
    await expect((service as any).introducesCycle(1, 2, 'org')).resolves.toBe(
      true,
    );
  });

  it('allows an acyclic edge', async () => {
    (service as any).dependencies.findBy.mockResolvedValue([
      { task_id: 2, depends_on_task_id: 3 },
    ]);
    await expect((service as any).introducesCycle(1, 2, 'org')).resolves.toBe(
      false,
    );
  });

  it('rejects a tampered date preview token', () => {
    process.env.JWT_ACCESS_TOKEN_SECRET = 'dependency-preview-test-secret';
    const token = (service as any).signPreview({ taskId: 1 });
    expect(() => (service as any).verifyPreview(`${token}x`)).toThrow(
      'Invalid preview token',
    );
  });
});
