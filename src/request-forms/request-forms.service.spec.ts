import { CustomFieldType } from 'src/custom-fields/custom-field-type';
import { CustomFieldDefinition } from 'src/typeorm/entities/CustomFieldDefinition';
import { RequestForm } from 'src/typeorm/entities/RequestForm';
import {
  RequestFormInputType,
  RequestFormTargetType,
} from 'src/typeorm/entities/RequestFormField';
import {
  RequestFormVersionState,
  RequestFormVisibility,
} from 'src/typeorm/entities/RequestFormVersion';
import { Status } from 'src/typeorm/entities/Status';
import { ProjectRole } from 'src/utils/constants/projectRole';
import {
  RequestFormConditionOperator,
  RequestFormDefinitionDto,
} from './dto/request-form.dto';
import { RequestFormsService } from './request-forms.service';

describe('RequestFormsService', () => {
  const forms = {
    manager: { getRepository: jest.fn() },
    find: jest.fn(),
    save: jest.fn(),
  };
  const statuses = { findOne: jest.fn() };
  const customFields = { find: jest.fn() };
  const dataSource = {
    getRepository: jest.fn((entity) => {
      if (entity === Status) return statuses;
      if (entity === CustomFieldDefinition) return customFields;
      return {};
    }),
    transaction: jest.fn(),
  };
  const authorization = { assertProjectPermission: jest.fn() };
  const activities = { createActivity: jest.fn() };
  const customFieldValues = { setTaskValuesInTransaction: jest.fn() };
  const entitlements = {
    resolveOrganization: jest.fn(),
    resolveForActor: jest.fn().mockResolvedValue([]),
  };
  const config = { get: jest.fn() };
  const storage = { uploadFile: jest.fn() };
  const automationEvents = { capture: jest.fn() };
  let service: RequestFormsService;

  beforeEach(() => {
    jest.clearAllMocks();
    statuses.findOne.mockResolvedValue({ id: 2, title: 'Inbox' });
    customFields.find.mockResolvedValue([]);
    service = new RequestFormsService(
      forms as any,
      dataSource as any,
      authorization as any,
      activities as any,
      customFieldValues as any,
      entitlements as any,
      config as any,
      storage as any,
      automationEvents as any,
      { append: jest.fn(), correlationId: jest.fn() } as any,
    );
  });

  it('validates only active conditional fields and normalizes typed answers', () => {
    const fields = [
      {
        key: 'title',
        input_type: RequestFormInputType.TEXT,
        required: true,
        position: 0,
        conditions: null,
      },
      {
        key: 'impact',
        input_type: RequestFormInputType.NUMBER,
        required: true,
        position: 1,
        conditions: [
          {
            fieldKey: 'title',
            operator: RequestFormConditionOperator.EQUALS,
            value: 'Incident',
          },
        ],
      },
    ];
    expect(
      (service as any).validateAnswers(fields, { title: '  Request  ' }),
    ).toMatchObject({
      valid: true,
      activeKeys: ['title'],
      normalized: { title: 'Request' },
    });
    expect(
      (service as any).validateAnswers(fields, { title: 'Incident' }),
    ).toMatchObject({
      valid: false,
      errors: [{ field: 'impact', code: 'required' }],
    });
  });

  it('rejects unknown and invalid typed answers', () => {
    const fields = [
      {
        key: 'due',
        input_type: RequestFormInputType.DATE,
        required: true,
        position: 0,
        conditions: null,
      },
    ];
    expect(
      (service as any).validateAnswers(fields, {
        due: 'not-a-date',
        injected: true,
      }),
    ).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        { field: 'injected', code: 'unknown_field' },
        { field: 'due', code: 'invalid_type' },
      ]),
    });
  });

  it('does not expose task mappings in respondent snapshots', () => {
    const snapshot = (service as any).serializeRespondentVersion({
      version_number: 3,
      title: 'Submit a request',
      description: null,
      confirmation_text: 'Received',
      destination_status_id: 99,
      fields: [
        {
          key: 'title',
          label: 'Title',
          input_type: RequestFormInputType.TEXT,
          target_type: RequestFormTargetType.STANDARD,
          standard_field: 'title',
          custom_field_id: null,
          required: true,
          position: 0,
          options_snapshot: null,
          conditions: null,
          config: null,
        },
      ],
    });
    expect(snapshot.destination_status_id).toBeUndefined();
    expect(snapshot.fields[0].targetType).toBeUndefined();
    expect(snapshot.fields[0].standardField).toBeUndefined();
  });

  it('accepts bounded attachment-name snapshots and rejects oversized lists', () => {
    const field = {
      key: 'evidence',
      input_type: RequestFormInputType.FILE,
      target_type: RequestFormTargetType.SUBMISSION_ONLY,
    };
    expect((service as any).normalizeAnswer(field, ['evidence.pdf'])).toEqual([
      'evidence.pdf',
    ]);
    expect(() =>
      (service as any).normalizeAnswer(field, Array(6).fill('file.pdf')),
    ).toThrow();
  });

  it('hashes source addresses without retaining the raw address', () => {
    config.get.mockImplementation((key: string) =>
      key === 'REQUEST_FORM_IP_HASH_SECRET' ? 'test-secret' : undefined,
    );
    const hash = (service as any).hashIp('203.0.113.9');
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain('203.0.113.9');
    expect((service as any).hashIp('203.0.113.9')).toBe(hash);
  });

  it('rejects destination statuses outside the form project', async () => {
    statuses.findOne.mockResolvedValue(null);
    await expect(
      (service as any).validateDefinition('org-1', 7, validDefinition()),
    ).rejects.toThrow('Destination status does not belong to this project');
  });

  it('requires exactly one required task title mapping', async () => {
    const dto = validDefinition();
    dto.fields[0].required = false;
    await expect(
      (service as any).validateDefinition('org-1', 7, dto),
    ).rejects.toThrow('exactly one required task title');
  });

  it('rejects conditions that reference later fields', async () => {
    const dto = validDefinition();
    dto.fields.push({
      key: 'details',
      label: 'Details',
      inputType: RequestFormInputType.TEXTAREA,
      targetType: RequestFormTargetType.SUBMISSION_ONLY,
      required: false,
      position: 1,
      conditions: [
        {
          fieldKey: 'future',
          operator: RequestFormConditionOperator.EQUALS,
          value: 'yes',
        },
      ],
    });
    dto.fields.push({
      key: 'future',
      label: 'Future',
      inputType: RequestFormInputType.TEXT,
      targetType: RequestFormTargetType.SUBMISSION_ONLY,
      required: false,
      position: 2,
    });
    await expect(
      (service as any).validateDefinition('org-1', 7, dto),
    ).rejects.toThrow('must reference an earlier field');
  });

  it('does not allow public forms to expose organization people', async () => {
    const dto = validDefinition();
    dto.visibility = RequestFormVisibility.PUBLIC;
    dto.fields.push({
      key: 'assignee',
      label: 'Assignee',
      inputType: RequestFormInputType.PERSON,
      targetType: RequestFormTargetType.STANDARD,
      standardField: 'assignees',
      required: false,
      position: 1,
    });
    await expect(
      (service as any).validateDefinition('org-1', 7, dto),
    ).rejects.toThrow('Public forms cannot expose organization person fields');
  });

  it('snapshots active options from a compatible custom field', async () => {
    customFields.find.mockResolvedValue([
      {
        id: '2d498a15-6734-4c12-8df3-6cb672715ca2',
        type: CustomFieldType.SINGLE_SELECT,
        options: [
          { key: 'b', label: 'Beta', position: 1, archived_at: null },
          { key: 'old', label: 'Old', position: 0, archived_at: new Date() },
          { key: 'a', label: 'Alpha', position: 0, archived_at: null },
        ],
      },
    ]);
    const dto = validDefinition();
    dto.fields.push({
      key: 'category',
      label: 'Category',
      inputType: RequestFormInputType.SINGLE_SELECT,
      targetType: RequestFormTargetType.CUSTOM_FIELD,
      customFieldId: '2d498a15-6734-4c12-8df3-6cb672715ca2',
      required: false,
      position: 1,
    });
    const result = await (service as any).validateDefinition('org-1', 7, dto);
    expect(result[1].options).toEqual([
      { key: 'a', label: 'Alpha' },
      { key: 'b', label: 'Beta' },
    ]);
  });

  it('allows only project owners to publish forms', async () => {
    authorization.assertProjectPermission.mockResolvedValue({
      role: ProjectRole.EDITOR,
    });
    await expect(
      service.publish(
        { userId: 3, role: 'user' } as any,
        'org-1',
        7,
        '67e74a07-74e1-42a1-bda8-d0ae474c9aca',
      ),
    ).rejects.toThrow('Only project owners can publish request forms');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('never updates a published version in place', async () => {
    authorization.assertProjectPermission.mockResolvedValue({});
    const form = {
      id: '67e74a07-74e1-42a1-bda8-d0ae474c9aca',
      versions: [{ state: RequestFormVersionState.PUBLISHED }],
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === RequestForm)
          return { findOne: jest.fn().mockResolvedValue(form) };
        return {};
      }),
    };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );
    await expect(
      service.updateDraft(
        { userId: 3 } as any,
        'org-1',
        7,
        form.id,
        validDefinition(),
      ),
    ).rejects.toThrow('Create a form draft first');
  });

  it('validates a 100-field form definition', async () => {
    const dto = validDefinition();
    dto.fields.push(
      ...Array.from({ length: 99 }, (_, index) => ({
        key: `question_${index + 1}`,
        label: `Question ${index + 1}`,
        inputType: RequestFormInputType.TEXT,
        targetType: RequestFormTargetType.SUBMISSION_ONLY,
        required: false,
        position: index + 1,
      })),
    );
    await expect(
      (service as any).validateDefinition('org-1', 7, dto),
    ).resolves.toHaveLength(100);
  });

  function validDefinition(): RequestFormDefinitionDto {
    return {
      name: 'Requests',
      title: 'Submit a request',
      visibility: RequestFormVisibility.ORGANIZATION,
      destinationStatusId: 2,
      fields: [
        {
          key: 'title',
          label: 'Request title',
          inputType: RequestFormInputType.TEXT,
          targetType: RequestFormTargetType.STANDARD,
          standardField: 'title',
          required: true,
          position: 0,
        },
      ],
    };
  }
});
