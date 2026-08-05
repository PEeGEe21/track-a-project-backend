import { BadRequestException } from '@nestjs/common';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { ProjectWorkflow } from 'src/typeorm/entities/ProjectWorkflow';
import { ProjectWorkflowTransition } from 'src/typeorm/entities/ProjectWorkflowTransition';
import { Status } from 'src/typeorm/entities/Status';
import { Task } from 'src/typeorm/entities/Task';
import { TaskCustomFieldValue } from 'src/typeorm/entities/TaskCustomFieldValue';
import { TaskTransitionHistory } from 'src/typeorm/entities/TaskTransitionHistory';
import { ProjectRole } from 'src/utils/constants/projectRole';
import { CustomWorkflowsService } from './custom-workflows.service';

describe('CustomWorkflowsService', () => {
  const workflows = { findOne: jest.fn() };
  const authorization = { assertProjectPermission: jest.fn() };
  const entitlements = { resolveForActor: jest.fn() };
  const statuses = { find: jest.fn(), findOne: jest.fn() };
  const tasks = { save: jest.fn() };
  const customFields = { count: jest.fn() };
  const customValues = { find: jest.fn() };
  const history = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const transitionQuery = {
    innerJoinAndSelect: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getOne: jest.fn(),
  };
  Object.values(transitionQuery).forEach((method) => {
    if (method !== transitionQuery.getOne)
      method.mockReturnValue(transitionQuery);
  });
  const transitions = { createQueryBuilder: jest.fn(() => transitionQuery) };
  const dataSource = {
    getRepository: jest.fn((entity) => {
      if (entity === Status) return statuses;
      if (entity === Task) return tasks;
      if (entity === CustomFieldDefinition) return customFields;
      if (entity === TaskCustomFieldValue) return customValues;
      if (entity === TaskTransitionHistory) return history;
      if (entity === ProjectWorkflowTransition) return transitions;
      if (entity === ProjectWorkflow) return workflows;
      return {};
    }),
  };
  let service: CustomWorkflowsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CustomWorkflowsService(
      workflows as any,
      authorization as any,
      entitlements as any,
      dataSource as any,
    );
  });

  it('rejects duplicate statuses before a draft can be saved', async () => {
    await expect(
      (service as any).validateDefinition('org-1', 7, {
        statuses: [
          { statusId: 1, key: 'todo', position: 0, isInitial: true },
          { statusId: 1, key: 'done', position: 1, isInitial: false },
        ],
        transitions: [],
      }),
    ).rejects.toThrow('Workflow statuses must be unique');
  });

  it('rejects workflow states that cannot be reached from the initial state', async () => {
    statuses.find.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    await expect(
      (service as any).validateDefinition('org-1', 7, {
        statuses: [
          { statusId: 1, key: 'todo', position: 0, isInitial: true },
          { statusId: 2, key: 'doing', position: 1, isInitial: false },
          { statusId: 3, key: 'done', position: 2, isInitial: false },
        ],
        transitions: [
          {
            key: 'start',
            sourceStatusId: 1,
            destinationStatusId: 2,
            allowedRoles: [ProjectRole.CONTRIBUTOR],
          },
        ],
      }),
    ).rejects.toThrow('Every workflow status must be reachable');
  });

  it('accepts legacy project statuses without an organization id', async () => {
    statuses.find.mockResolvedValue([
      { id: 1, project: { id: 7 }, organization_id: 'org-1' },
      { id: 2, project: { id: 7 }, organization_id: null },
    ]);

    await expect(
      (service as any).validateDefinition('org-1', 7, {
        statuses: [
          { statusId: 1, key: 'todo', position: 0, isInitial: true },
          { statusId: 2, key: 'done', position: 1, isInitial: false },
        ],
        transitions: [
          {
            key: 'finish',
            sourceStatusId: 1,
            destinationStatusId: 2,
            allowedRoles: [ProjectRole.CONTRIBUTOR],
          },
        ],
      }),
    ).resolves.toBeUndefined();
    expect(statuses.find).toHaveBeenCalledWith({
      where: { id: expect.anything(), project: { id: 7 } },
      relations: ['project'],
    });
  });

  it('preserves legacy unrestricted transitions while the capability is off', async () => {
    const destination = { id: 2, project: { id: 7 } };
    statuses.findOne.mockResolvedValue(destination);
    tasks.save.mockImplementation(async (task) => task);
    entitlements.resolveForActor.mockResolvedValue([
      { key: 'custom_workflows', enabled: false },
    ]);
    const manager = {
      getRepository: (entity) => (entity === Status ? statuses : tasks),
    };
    const task = {
      id: 10,
      project: { id: 7 },
      status: { id: 1 },
    } as Task;

    await service.transitionTask(
      manager as any,
      { userId: 3, email: 'a@example.com', role: 'user' },
      'org-1',
      task,
      2,
    );

    expect(task.status).toBe(destination);
    expect(tasks.save).toHaveBeenCalledWith(task);
    expect(authorization.assertProjectPermission).not.toHaveBeenCalled();
  });

  it('rejects destination statuses outside the task project', async () => {
    statuses.findOne.mockResolvedValue(null);
    await expect(
      service.transitionTask(
        { getRepository: () => statuses } as any,
        { userId: 3, email: 'a@example.com', role: 'user' },
        'org-1',
        { id: 10, project: { id: 7 }, status: { id: 1 } } as Task,
        99,
      ),
    ).rejects.toThrow('Destination status is unavailable');
    expect(entitlements.resolveForActor).not.toHaveBeenCalled();
  });

  it('enforces transition roles when custom workflows are enabled', async () => {
    statuses.findOne.mockResolvedValue({ id: 2, title: 'Done' });
    entitlements.resolveForActor.mockResolvedValue([
      { key: 'custom_workflows', enabled: true },
    ]);
    authorization.assertProjectPermission.mockResolvedValue({
      role: ProjectRole.CONTRIBUTOR,
    });
    workflows.findOne.mockResolvedValue({ id: 'workflow-1' });
    transitionQuery.getOne.mockResolvedValue({
      allowed_roles: [ProjectRole.OWNER],
    });
    const manager = managerForTransitions();

    await expect(
      service.transitionTask(
        manager as any,
        { userId: 3, email: 'a@example.com', role: 'user' },
        'org-1',
        governedTask(),
        2,
      ),
    ).rejects.toThrow('Your project role cannot perform this transition');
    expect(tasks.save).not.toHaveBeenCalled();
  });

  it('rejects transitions with missing required standard fields', async () => {
    statuses.findOne.mockResolvedValue({ id: 2, title: 'Done' });
    entitlements.resolveForActor.mockResolvedValue([
      { key: 'custom_workflows', enabled: true },
    ]);
    authorization.assertProjectPermission.mockResolvedValue({
      role: ProjectRole.CONTRIBUTOR,
    });
    workflows.findOne.mockResolvedValue({ id: 'workflow-1' });
    transitionQuery.getOne.mockResolvedValue({
      allowed_roles: [ProjectRole.CONTRIBUTOR],
      requirements: { standardFields: ['due_date'] },
    });

    await expect(
      service.transitionTask(
        managerForTransitions() as any,
        { userId: 3, email: 'a@example.com', role: 'user' },
        'org-1',
        governedTask(),
        2,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ fields: ['due_date'] }),
    });
  });

  it('records an immutable history snapshot for an allowed transition', async () => {
    const destination = { id: 2, title: 'Done' };
    statuses.findOne.mockResolvedValue(destination);
    entitlements.resolveForActor.mockResolvedValue([
      { key: 'custom_workflows', enabled: true },
    ]);
    authorization.assertProjectPermission.mockResolvedValue({
      role: ProjectRole.EDITOR,
    });
    workflows.findOne.mockResolvedValue({ id: 'workflow-1' });
    transitionQuery.getOne.mockResolvedValue({
      key: 'finish',
      version: { id: 'version-2' },
      allowed_roles: [ProjectRole.EDITOR],
      requirements: { standardFields: ['title'], customFieldIds: [] },
    });
    const task = governedTask();

    await service.transitionTask(
      managerForTransitions() as any,
      { userId: 3, email: 'a@example.com', role: 'user' },
      'org-1',
      task,
      2,
    );

    expect(tasks.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: destination }),
    );
    expect(history.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transition_key: 'finish',
        source_status_title: 'Todo',
        destination_status_title: 'Done',
        validated_fields: {
          standardFields: ['title'],
          customFieldIds: [],
        },
      }),
    );
  });

  it('allows only project owners to publish a workflow', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      role: ProjectRole.EDITOR,
    });
    await expect(
      service.publish(
        { userId: 3, email: 'a@example.com', role: 'user' },
        'org-1',
        7,
        {},
      ),
    ).rejects.toThrow('Only project owners can publish workflows');
  });

  it('allows only project owners to reset a workflow', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      role: ProjectRole.EDITOR,
    });
    await expect(
      service.resetToDefault(
        { userId: 3, email: 'a@example.com', role: 'user' },
        'org-1',
        7,
      ),
    ).rejects.toThrow('Only project owners can reset workflows');
  });

  it('validates a large reachable workflow graph', async () => {
    const workflowStatuses = Array.from({ length: 50 }, (_, index) => ({
      statusId: index + 1,
      key: `status_${index + 1}`,
      position: index,
      isInitial: index === 0,
      isTerminal: index === 49,
    }));
    statuses.find.mockResolvedValue(
      workflowStatuses.map((item) => ({ id: item.statusId })),
    );
    const workflowTransitions = workflowStatuses
      .slice(0, -1)
      .map((item, index) => ({
        key: `step_${index + 1}`,
        sourceStatusId: item.statusId,
        destinationStatusId: workflowStatuses[index + 1].statusId,
        allowedRoles: [ProjectRole.CONTRIBUTOR],
      }));

    await expect(
      (service as any).validateDefinition('org-1', 7, {
        statuses: workflowStatuses,
        transitions: workflowTransitions,
      }),
    ).resolves.toBeUndefined();
  });

  function governedTask() {
    return {
      id: 10,
      title: 'Ship it',
      due_date: null,
      assignees: [],
      project: { id: 7 },
      status: { id: 1, title: 'Todo' },
    } as Task;
  }

  function managerForTransitions() {
    return {
      getRepository: (entity) => {
        if (entity === Status) return statuses;
        if (entity === Task) return tasks;
        if (entity === ProjectWorkflowTransition) return transitions;
        if (entity === TaskCustomFieldValue) return customValues;
        if (entity === TaskTransitionHistory) return history;
        throw new Error(`Unexpected repository ${entity?.name}`);
      },
    };
  }
});
