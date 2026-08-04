import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProjectPermission } from 'src/common/authorization/authorization.service';
import { CustomFieldType } from './custom-field-type';
import { CustomFieldsService } from './custom-fields.service';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { TaskCustomFieldValue } from 'src/typeorm/entities/TaskCustomFieldValue';

describe('CustomFieldsService', () => {
  const actor: any = { userId: 7, role: 'user' };
  const authorization = { assertProjectPermission: jest.fn() };
  const definitions: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
  };
  const values: any = { count: jest.fn(), find: jest.fn() };
  const dataSource: any = {
    transaction: jest.fn(),
    getRepository: jest.fn(),
    manager: { getRepository: jest.fn() },
  };
  const activities: any = { createActivity: jest.fn() };
  let service: CustomFieldsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CustomFieldsService(
      dataSource,
      authorization as any,
      definitions,
      values,
      activities,
    );
  });

  it('scopes reads to the organization and project', async () => {
    definitions.find.mockResolvedValue([]);
    await service.list(actor, 'org-a', 12);
    expect(authorization.assertProjectPermission).toHaveBeenCalledWith(
      actor,
      'org-a',
      12,
      ProjectPermission.VIEW,
    );
    expect(definitions.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-a',
          project_id: 12,
        }),
      }),
    );
  });

  it('requires editor permission before creating a definition', async () => {
    authorization.assertProjectPermission.mockRejectedValueOnce(
      new ForbiddenException(),
    );
    await expect(
      service.create(actor, 'org-a', 12, {
        key: 'customer',
        name: 'Customer',
        type: CustomFieldType.TEXT,
      }),
    ).rejects.toBeDefined();
    expect(authorization.assertProjectPermission).toHaveBeenCalledWith(
      actor,
      'org-a',
      12,
      ProjectPermission.EDIT,
    );
  });

  it('rejects options on a non-select field before writing', async () => {
    authorization.assertProjectPermission.mockResolvedValue({});
    await expect(
      service.create(actor, 'org-a', 12, {
        key: 'customer',
        name: 'Customer',
        type: CustomFieldType.TEXT,
        options: [{ key: 'one', label: 'One' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('does not allow a populated field to change type', async () => {
    authorization.assertProjectPermission.mockResolvedValue({});
    definitions.findOne.mockResolvedValue({
      id: 'field-1',
      organization_id: 'org-a',
      project_id: 12,
      type: CustomFieldType.TEXT,
      options: [],
    });
    values.count.mockResolvedValue(1);
    await expect(
      service.update(actor, 'org-a', 12, 'field-1', {
        type: CustomFieldType.NUMBER,
      }),
    ).rejects.toThrow('cannot change type');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('records a content-minimal project activity after creation', async () => {
    authorization.assertProjectPermission.mockResolvedValue({});
    dataSource.transaction.mockResolvedValue({
      id: 'field-1',
      key: 'customer',
      name: 'Customer',
      type: CustomFieldType.TEXT,
      options: [],
    });

    await service.create(actor, 'org-a', 12, {
      key: 'customer',
      name: 'Customer',
      type: CustomFieldType.TEXT,
    });

    expect(activities.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-a',
        projectId: 12,
        userId: 7,
        entityType: 'custom_field_definition',
        metadata: expect.objectContaining({
          action: 'created',
          fieldId: 'field-1',
          fieldKey: 'customer',
        }),
      }),
    );
  });

  it('archives a definition without deleting its values or options', async () => {
    authorization.assertProjectPermission.mockResolvedValue({});
    const definition = {
      id: 'field-1',
      key: 'customer',
      name: 'Customer',
      type: CustomFieldType.TEXT,
      archived_at: null,
      options: [],
    };
    definitions.findOne.mockResolvedValue(definition);
    definitions.save.mockImplementation(async (value) => value);

    await service.archive(actor, 'org-a', 12, 'field-1');

    expect(definition.archived_at).toBeInstanceOf(Date);
    expect(definitions.save).toHaveBeenCalledWith(definition);
    expect(activities.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ action: 'archived' }),
      }),
    );
  });

  it.each([
    [CustomFieldType.TEXT, 'hello', 'hello'],
    [CustomFieldType.NUMBER, 12.5, 12.5],
    [CustomFieldType.DATE, '2026-08-04', '2026-08-04'],
    [CustomFieldType.CHECKBOX, false, false],
    [
      CustomFieldType.URL,
      ' https://example.com/path ',
      'https://example.com/path',
    ],
    [CustomFieldType.SINGLE_SELECT, 'open', 'open'],
    [CustomFieldType.MULTI_SELECT, ['open', 'closed'], ['open', 'closed']],
  ])('normalizes valid %s values', async (type, input, expected) => {
    const definition: any = {
      id: 'field-1',
      key: 'field',
      name: 'Field',
      type,
      options: [
        { key: 'open', archived_at: null },
        { key: 'closed', archived_at: null },
      ],
    };
    await expect(
      (service as any).normalizeValue(
        dataSource.manager,
        'org-a',
        definition,
        input,
      ),
    ).resolves.toEqual(expected);
  });

  it('rejects invalid calendar dates and archived select options', async () => {
    const definition: any = {
      id: 'field-1',
      key: 'field',
      name: 'Field',
      type: CustomFieldType.DATE,
      options: [],
    };
    await expect(
      (service as any).normalizeValue(
        dataSource.manager,
        'org-a',
        definition,
        '2026-02-30',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    definition.type = CustomFieldType.SINGLE_SELECT;
    definition.options = [{ key: 'retired', archived_at: new Date() }];
    await expect(
      (service as any).normalizeValue(
        dataSource.manager,
        'org-a',
        definition,
        'retired',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a bulk write that leaves a required field empty', async () => {
    const definitionRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'required-field',
          key: 'customer',
          name: 'Customer',
          type: CustomFieldType.TEXT,
          required: true,
          default_value: null,
          options: [],
        },
      ]),
    };
    const valueRepo = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const manager: any = {
      getRepository: jest.fn((entity) =>
        entity === CustomFieldDefinition ? definitionRepo : valueRepo,
      ),
    };

    await expect(
      service.setTaskValuesInTransaction(manager, 'org-a', 12, 55, [], false),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Required custom fields are missing',
      }),
    });
    expect(valueRepo.delete).not.toHaveBeenCalled();
    expect(manager.getRepository).toHaveBeenCalledWith(TaskCustomFieldValue);
  });

  it('applies normalized defaults when creating a task', async () => {
    const definitionRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'required-field',
          key: 'customer',
          name: 'Customer',
          type: CustomFieldType.TEXT,
          required: true,
          default_value: 'Default customer',
          options: [],
        },
      ]),
    };
    const valueRepo = {
      find: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const manager: any = {
      getRepository: jest.fn((entity) =>
        entity === CustomFieldDefinition ? definitionRepo : valueRepo,
      ),
    };

    await service.setTaskValuesInTransaction(
      manager,
      'org-a',
      12,
      55,
      [],
      true,
    );

    expect(valueRepo.save).toHaveBeenCalledWith([
      {
        task_id: 55,
        definition_id: 'required-field',
        value: 'Default customer',
      },
    ]);
  });

  it('rejects a person outside the active organization membership', async () => {
    dataSource.manager.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });
    const definition: any = {
      id: 'person-field',
      key: 'owner',
      name: 'Owner',
      type: CustomFieldType.PERSON,
      options: [],
    };
    await expect(
      (service as any).normalizeValue(
        dataSource.manager,
        'org-a',
        definition,
        999,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        reason: 'user_is_not_an_active_organization_member',
      }),
    });
  });

  it('normalizes typed filters and rejects incompatible operators', async () => {
    definitions.find.mockResolvedValue([
      {
        id: 'amount-field',
        organization_id: 'org-a',
        key: 'amount',
        name: 'Amount',
        type: CustomFieldType.NUMBER,
        archived_at: null,
        options: [],
      },
    ]);
    await expect(
      service.prepareFilters('org-a', [
        { fieldId: 'amount-field', operator: 'gte', value: 12.5 },
      ]),
    ).resolves.toEqual([
      {
        fieldId: 'amount-field',
        type: CustomFieldType.NUMBER,
        operator: 'gte',
        value: 12.5,
      },
    ]);

    definitions.find.mockResolvedValue([
      {
        id: 'text-field',
        key: 'customer',
        name: 'Customer',
        type: CustomFieldType.TEXT,
        archived_at: null,
        options: [],
      },
    ]);
    await expect(
      service.prepareFilters('org-a', [
        { fieldId: 'text-field', operator: 'gt', value: 'a' },
      ]),
    ).rejects.toThrow('not supported');
  });

  it('rejects filters for archived or cross-organization definitions', async () => {
    definitions.find.mockResolvedValue([]);
    await expect(
      service.prepareFilters('org-a', [
        { fieldId: 'foreign-field', operator: 'eq', value: 'secret' },
      ]),
    ).rejects.toThrow('active organization field');
  });

  it('does not let an unassigned contributor change another user task', async () => {
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue({
        id: 55,
        title: 'Restricted task',
        project: { id: 12 },
        user: { id: 99 },
        assignees: [],
      }),
    });
    authorization.assertProjectPermission.mockResolvedValue({
      role: 'contributor',
    });

    await expect(service.setTaskValues(actor, 'org-a', 55, [])).rejects.toThrow(
      'created or are assigned',
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('batches large task serialization and retains only valued archived fields', async () => {
    const tasks = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      projectId: 12,
    }));
    definitions.find.mockResolvedValue([
      {
        id: 'active-field',
        project_id: 12,
        key: 'active',
        name: 'Active',
        type: CustomFieldType.TEXT,
        required: false,
        archived_at: null,
        options: [],
      },
      {
        id: 'archived-valued',
        project_id: 12,
        key: 'old',
        name: 'Old',
        type: CustomFieldType.TEXT,
        required: false,
        archived_at: new Date(),
        options: [],
      },
      {
        id: 'archived-empty',
        project_id: 12,
        key: 'unused',
        name: 'Unused',
        type: CustomFieldType.TEXT,
        required: false,
        archived_at: new Date(),
        options: [],
      },
    ]);
    values.find.mockResolvedValue([
      {
        task_id: 1,
        definition_id: 'archived-valued',
        value: 'history',
      },
    ]);

    const result = await service.serializeTasks('org-a', tasks);

    expect(definitions.find).toHaveBeenCalledTimes(1);
    expect(values.find).toHaveBeenCalledTimes(1);
    expect(result.get(1)?.map((field) => field.key)).toEqual(['active', 'old']);
    expect(result.get(2)?.map((field) => field.key)).toEqual(['active']);
    expect(result.size).toBe(100);
  });
});
