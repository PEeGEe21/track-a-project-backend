import { ProjectsService } from './projects.service';
import * as ExcelJS from 'exceljs';

describe('ProjectsService ingestion settings', () => {
  const usersService = {
    getUserAccountById: jest.fn(),
  };
  const ingestionKeyService = {
    generateRawKey: jest.fn(),
    hashKey: jest.fn(),
    getKeyPrefix: jest.fn(),
    buildLabel: jest.fn(),
    isTestKey: jest.fn(),
  };
  const projectRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const projectPeerRepository = {
    exists: jest.fn(),
  };
  const statusRepository = {
    findOne: jest.fn(),
  };
  const ingestApiKeyRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const projectIngestionSettingsRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const projectStatusTemplateRepository = {
    find: jest.fn(),
  };
  const authorizationService = {
    assertProjectPermission: jest.fn(),
  };
  const customFieldsService = {
    serializeTasks: jest.fn(),
  };
  const entitlementsService = {
    resolveForActor: jest.fn(),
  };

  let service: ProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ProjectsService(
      usersService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      ingestionKeyService as any,
      {} as any,
      {} as any,
      {} as any,
      projectRepository as any,
      {} as any,
      projectPeerRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      statusRepository as any,
      {} as any,
      {} as any,
      {} as any,
      ingestApiKeyRepository as any,
      projectIngestionSettingsRepository as any,
      projectStatusTemplateRepository as any,
      authorizationService as any,
      customFieldsService as any,
      entitlementsService as any,
      {} as any,
    );
    authorizationService.assertProjectPermission.mockImplementation(
      async () => ({
        project: await projectRepository.findOne(),
        role: 'owner',
      }),
    );
  });

  it('exports stable custom-field metadata and normalized values', async () => {
    usersService.getUserAccountById.mockResolvedValue({ id: 10 });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      title: 'Export project',
      description: '',
      status: 'active',
      user: { id: 10, first_name: 'Owner', last_name: '', email: 'o@test' },
      tasks: [
        {
          id: 55,
          title: 'Task one',
          description: '',
          priority: 0,
          assignees: [],
          resources: [],
        },
      ],
      projectPeers: [],
      resources: [],
    });
    entitlementsService.resolveForActor.mockResolvedValue([
      { key: 'custom_fields', enabled: true },
    ]);
    customFieldsService.serializeTasks.mockResolvedValue(
      new Map([
        [
          55,
          [
            {
              key: 'regions',
              name: 'Regions',
              type: 'multi_select',
              archived: false,
              value: ['west', 'north'],
            },
          ],
        ],
      ]),
    );

    const exported = await service.exportProjectWorkbook(
      7,
      { userId: 10 },
      'org-1',
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported.content as any);
    const sheet = workbook.getWorksheet('Custom Fields');

    expect(authorizationService.assertProjectPermission).toHaveBeenCalled();
    expect(sheet?.getRow(1).values).toEqual([
      undefined,
      'Task ID',
      'Task Title',
      'Field Key',
      'Field Name',
      'Field Type',
      'Archived',
      'Normalized Value',
    ]);
    expect(sheet?.getRow(2).getCell(3).value).toBe('regions');
    expect(sheet?.getRow(2).getCell(7).value).toBe('["west","north"]');
  });

  it('rejects key creation when the default ingestion status is missing', async () => {
    usersService.getUserAccountById.mockResolvedValue({ id: 10 });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      default_ingestion_status_id: null,
      user: { id: 10 },
    });
    projectPeerRepository.exists.mockResolvedValue(false);

    await expect(
      service.createIngestKeyForProject(
        { userId: 10, role: 'member' },
        7,
        'org_1',
        'live',
        {},
      ),
    ).rejects.toThrow(
      'Set a default ingestion status before generating an API key',
    );

    expect(ingestApiKeyRepository.save).not.toHaveBeenCalled();
  });

  it('creates and returns a live ingestion key when the project is configured', async () => {
    usersService.getUserAccountById.mockResolvedValue({ id: 10 });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      default_ingestion_status_id: 4,
      user: { id: 10 },
    });
    projectPeerRepository.exists.mockResolvedValue(false);
    ingestionKeyService.generateRawKey.mockReturnValue('trk_live_secret');
    ingestionKeyService.hashKey.mockReturnValue('hashed-secret');
    ingestionKeyService.getKeyPrefix.mockReturnValue('trk_live_secret');
    ingestionKeyService.buildLabel.mockReturnValue('Production key');
    ingestionKeyService.isTestKey.mockReturnValue(false);
    ingestApiKeyRepository.create.mockImplementation((value) => value);
    ingestApiKeyRepository.save.mockImplementation(async (value) => ({
      id: 99,
      created_at: new Date('2026-06-20T10:00:00.000Z'),
      updated_at: new Date('2026-06-20T10:00:00.000Z'),
      revoked_at: null,
      last_used_at: null,
      ...value,
    }));

    await expect(
      service.createIngestKeyForProject(
        { userId: 10, role: 'member' },
        7,
        'org_1',
        'live',
        { label: 'Production key' },
      ),
    ).resolves.toEqual({
      success: true,
      message: 'Live ingestion key created successfully',
      data: expect.objectContaining({
        id: 99,
        label: 'Production key',
        keyPrefix: 'trk_live_secret',
        mode: 'live',
        apiKey: 'trk_live_secret',
      }),
    });
  });

  it('rejects default ingestion status updates when the status is outside the project', async () => {
    usersService.getUserAccountById.mockResolvedValue({ id: 10 });
    projectRepository.findOne.mockResolvedValue({
      id: 7,
      organization_id: 'org_1',
      default_ingestion_status_id: 4,
      user: { id: 10 },
    });
    projectPeerRepository.exists.mockResolvedValue(false);
    statusRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateDefaultIngestionStatus(
        { userId: 10, role: 'member' },
        7,
        'org_1',
        55,
      ),
    ).rejects.toThrow(
      'Selected ingestion status does not belong to this project',
    );
  });

  it('updates the default ingestion status when the status belongs to the project', async () => {
    const project = {
      id: 7,
      organization_id: 'org_1',
      default_ingestion_status_id: 4,
      user: { id: 10 },
    };

    usersService.getUserAccountById.mockResolvedValue({ id: 10 });
    projectRepository.findOne.mockResolvedValue(project);
    projectPeerRepository.exists.mockResolvedValue(false);
    projectIngestionSettingsRepository.findOne.mockResolvedValue(null);
    projectIngestionSettingsRepository.create.mockImplementation(
      (value) => value,
    );
    projectIngestionSettingsRepository.save.mockImplementation(
      async (value) => value,
    );
    statusRepository.findOne.mockResolvedValue({
      id: 8,
      title: 'Inbox',
      color: '#123456',
      isTerminal: false,
    });
    projectRepository.save.mockImplementation(async (value) => value);

    await expect(
      service.updateDefaultIngestionStatus(
        { userId: 10, role: 'member' },
        7,
        'org_1',
        8,
        'reopen_if_recent',
        14,
      ),
    ).resolves.toEqual({
      success: true,
      message: 'Default ingestion status updated successfully',
      data: {
        projectId: 7,
        default_ingestion_status_id: 8,
        default_ingestion_status: {
          id: 8,
          title: 'Inbox',
          color: '#123456',
          isTerminal: false,
        },
        ingestion_closed_task_dedupe_behavior: 'reopen_if_recent',
        closed_task_reopen_window_days: 14,
      },
    });
  });

  it('falls back to marking Done as terminal when no configured template is terminal', () => {
    const normalized = (service as any).normalizeProjectStatuses([
      { title: 'To Do', color: '#94A3B8', isTerminal: false },
      { title: 'In Progress', color: '#3B82F6', isTerminal: false },
      { title: 'Done', color: '#10B981', isTerminal: false },
    ]);

    expect(normalized.map((status) => status.isTerminal)).toEqual([
      false,
      false,
      true,
    ]);
  });
});
