import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProjectRole } from 'src/utils/constants/projectRole';
import {
  AutomationActionType,
  AutomationConditionOperator,
  AutomationTriggerType,
} from './automation-contract';
import { AutomationsService } from './automations.service';

describe('AutomationsService', () => {
  const actor = { userId: 7, role: 'member' } as any;
  const repository = {
    count: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
  };
  const manager = { getRepository: jest.fn(() => repository) } as any;
  const dataSource = {
    manager,
    getRepository: jest.fn(() => repository),
    transaction: jest.fn(),
  } as any;
  const authorization = {
    assertProjectPermission: jest.fn(),
  } as any;
  let service: AutomationsService;

  const definition = () => ({
    trigger: { type: AutomationTriggerType.TASK_CREATED, config: {} },
    conditions: [],
    actions: [
      {
        key: 'set_priority',
        type: AutomationActionType.UPDATE_FIELD,
        config: { field: 'priority', value: 2 },
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    repository.count.mockResolvedValue(0);
    repository.find.mockResolvedValue([]);
    service = new AutomationsService(dataSource, authorization);
  });

  it('accepts a bounded rule contract and returns a detached snapshot', async () => {
    const dto = definition();
    const result = await (service as any).validateDefinition('org-1', 10, dto);
    expect(result).toEqual(dto);
    expect(result).not.toBe(dto);
  });

  it('accepts task.ingested conditions from the normalized intake contract', async () => {
    const dto = definition() as any;
    dto.trigger = { type: AutomationTriggerType.TASK_INGESTED, config: {} };
    dto.conditions = [
      { field: 'channel', operator: 'equals', value: 'email' },
      { field: 'source', operator: 'equals', value: 'api' },
      { field: 'outcome', operator: 'equals', value: 'created' },
      { field: 'occurrence_count', operator: 'greater_than', value: 1 },
    ];

    await expect(
      (service as any).validateDefinition('org-1', 10, dto),
    ).resolves.toEqual(dto);
  });

  it('rejects ingestion-only conditions on other triggers', async () => {
    const dto = definition() as any;
    dto.conditions = [{ field: 'channel', operator: 'equals', value: 'email' }];

    await expect(
      (service as any).validateDefinition('org-1', 10, dto),
    ).rejects.toThrow('Unsupported automation field: channel');
  });

  it('rejects duplicate action keys', async () => {
    const dto = definition();
    dto.actions.push({ ...dto.actions[0] });
    await expect(
      (service as any).validateDefinition('org-1', 10, dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown configuration keys', async () => {
    const dto = definition();
    dto.actions[0].config = {
      field: 'priority',
      value: 2,
      privilegedBypass: true,
    } as any;
    await expect(
      (service as any).validateDefinition('org-1', 10, dto),
    ).rejects.toThrow('Unsupported configuration keys');
  });

  it('rejects references to another project', async () => {
    const dto = definition() as any;
    dto.conditions = [{ field: 'project_id', operator: 'equals', value: 11 }];
    await expect(
      (service as any).validateDefinition('org-1', 10, dto),
    ).rejects.toThrow('cannot reference another project');
  });

  it('rejects a status action when the status is outside the project', async () => {
    const dto = definition() as any;
    dto.actions = [
      {
        key: 'move',
        type: AutomationActionType.TRANSITION_STATUS,
        config: { statusId: 99 },
      },
    ];
    repository.count.mockResolvedValue(0);
    await expect(
      (service as any).validateDefinition('org-1', 10, dto),
    ).rejects.toThrow('referenced status is unavailable');
  });

  it('requires an owner to publish, enable, disable, or archive', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      role: ProjectRole.EDITOR,
    });
    await expect(
      service.publish(
        actor,
        'org-1',
        10,
        '5b48c6f2-2d73-4a84-97cb-92385ab3ca92',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('hides draft definitions from non-editing project roles', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      role: ProjectRole.VIEWER,
    });
    repository.findOne.mockResolvedValue({
      id: '5b48c6f2-2d73-4a84-97cb-92385ab3ca92',
      stable_key: 'rule_a',
      name: 'Rule A',
      description: null,
      active: true,
      authorization_policy: 'editor',
      archived_at: null,
      published_version: null,
      draft_version: {
        id: 'e4039827-3775-40b0-a216-8075800add2a',
        version_number: 1,
        state: 'draft',
        schema_version: 1,
        definition: definition(),
      },
      created_by_id: 7,
      last_material_editor_id: 7,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const result = await service.get(
      actor,
      'org-1',
      10,
      '5b48c6f2-2d73-4a84-97cb-92385ab3ca92',
    );
    expect(result.data).not.toHaveProperty('draft');
  });

  it('dry-runs the saved definition without persisting or mutating', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      role: ProjectRole.EDITOR,
    });
    const dryDefinition = definition() as any;
    dryDefinition.conditions = [
      {
        field: 'priority',
        operator: AutomationConditionOperator.EQUALS,
        value: 2,
      },
    ];
    repository.findOne.mockResolvedValue({
      id: '5b48c6f2-2d73-4a84-97cb-92385ab3ca92',
      organization_id: 'org-1',
      project_id: 10,
      draft_version: { definition: dryDefinition },
      published_version: null,
      versions: [],
    });

    const result = await service.dryRun(
      actor,
      'org-1',
      10,
      '5b48c6f2-2d73-4a84-97cb-92385ab3ca92',
      { payload: { after: { priority: 2 } } },
    );

    expect(result.data).toMatchObject({
      dryRun: true,
      mutated: false,
      matched: true,
      actions: [{ key: 'set_priority', outcome: 'would_run' }],
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('scopes run history to the requested organization and project', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      role: ProjectRole.VIEWER,
    });
    repository.findAndCount.mockResolvedValue([[], 0]);

    const result = await service.listRuns(actor, 'org-1', 10, {
      limit: 25,
      offset: 0,
    });

    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organization_id: 'org-1', project_id: 10 },
        take: 25,
        skip: 0,
      }),
    );
    expect(result).toMatchObject({
      data: [],
      meta: { total: 0, hasMore: false },
    });
  });
});
